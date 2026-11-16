import jwt from 'jsonwebtoken';

/**
 * Plain-HTTP client for viaSocket's "apps in the product" API (the module published at
 * https://viasocket.com/docs/apps-api.md), trimmed to what Outcome Ledger needs.
 *
 * SERVER ONLY. The embed secret, every `auth_id` and every `script_id` pass through here and must never be
 * logged, returned to the browser (except the per-user embed token) or put into an error message.
 */

const API = 'https://flow-api.viasocket.com';
const RUN = 'https://flow.sokt.io';
const SERVICES = '/embed/services';
export const TIMEOUT_MS = 15_000;

// The two actions we use. Keys are case-sensitive and versions are pinned, as viaSocket's pages require.
// `actionId` is only a fallback for the Connect popup; the live value is read from listActions().
export const APPS = {
  sheets: { slug: 'google-sheets', action: 'Add_New_Row_to_Sheet', version: 'v66', actionId: 'rowxsuumuqrt' },
  slack: { slug: 'slack', action: 'Send_Message', version: 'v107', actionId: 'row1jrbor' },
};

const SCRIPT_ID = /^[A-Za-z0-9_-]{4,80}$/;
const AUTH_ID = /^[A-Za-z0-9_.:-]{4,300}$/;
export const isScriptId = (v) => typeof v === 'string' && SCRIPT_ID.test(v);
export const isAuthId = (v) => typeof v === 'string' && AUTH_ID.test(v);

export class ViaSocketError extends Error {
  constructor(message, { status = null, notConfigured = false } = {}) {
    super(message);
    this.name = 'ViaSocketError';
    this.status = status;
    this.notConfigured = notConfigured;
  }
}

export function createViaSocket({ orgId = '', projectId = '', embedSecret = '' } = {}, { fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
  const missing = [['VIASOCKET_ORG_ID', orgId], ['VIASOCKET_PROJECT_ID', projectId], ['VIASOCKET_EMBED_SECRET', embedSecret]].filter(([, v]) => !v).map(([k]) => k);
  const configured = missing.length === 0;
  const need = () => {
    if (!configured) throw new ViaSocketError(`viaSocket is not set up: missing ${missing.join(', ')}`, { notConfigured: true });
  };

  // HS256 JWT with org_id, project_id and unique_identifier. One per user; the browser may hold it (Connect popup only).
  const embedToken = (userId) => {
    need();
    return jwt.sign({ org_id: orgId, project_id: projectId, unique_identifier: String(userId) }, embedSecret, { algorithm: 'HS256' });
  };

  async function send(url, init) {
    let res;
    try {
      res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      // Never include the URL: it can contain an auth_id or a script_id.
      throw new ViaSocketError(e?.name === 'TimeoutError' ? 'viaSocket did not answer in time' : `Could not reach viaSocket (${e?.code || e?.name || 'network error'})`);
    }
    const text = await res.text();
    let body = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* not JSON */
    }
    return { res, body };
  }

  async function apiCall(userId, method, path, payload) {
    need();
    const { res, body } = await send(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', authorization: embedToken(userId) }, // the bare token, no "Bearer"
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    if (!res.ok || body?.success === false) {
      const why = typeof body?.message === 'string' ? `: ${body.message.slice(0, 120)}` : '';
      throw new ViaSocketError(`viaSocket answered ${res.status}${why}`, { status: res.status });
    }
    return body?.data;
  }

  const actionsCache = new Map(); // slug -> { at, body }
  async function listActions(userId, slug) {
    const hit = actionsCache.get(slug);
    if (hit && Date.now() - hit.at < 600_000) return hit.body;
    const body = await apiCall(userId, 'GET', `${SERVICES}/${encodeURIComponent(slug)}/actions`);
    actionsCache.set(slug, { at: Date.now(), body });
    return body;
  }

  const serviceIdFor = async (userId, slug) => (await listActions(userId, slug)).service_id;

  const listConnections = async (userId) => (await apiCall(userId, 'GET', '/embed/authentications')) || [];
  const revokeConnection = (userId, authId) => {
    if (!isAuthId(authId)) throw new ViaSocketError('Bad connection id');
    return apiCall(userId, 'DELETE', `/embed/authentications/revoke/${encodeURIComponent(authId)}`);
  };
  const listFlows = async (userId) => (await apiCall(userId, 'GET', `/projects/${encodeURIComponent(projectId)}/integrations`))?.flows || [];

  async function findEnabledApp(userId, slug) {
    const serviceId = await serviceIdFor(userId, slug);
    return (await listFlows(userId)).find((f) => f.service_id === serviceId && (f.status === 'active' || f.status === 'paused'))?.id || null;
  }
  async function enableApp(userId, slug, authId) {
    if (!isAuthId(authId)) throw new ViaSocketError('Bad connection id');
    const out = await apiCall(userId, 'POST', `${SERVICES}/${encodeURIComponent(slug)}/enable/${encodeURIComponent(authId)}`);
    return out?.script_id;
  }
  const setFlowStatus = (userId, scriptId, status) => apiCall(userId, 'PUT', `/embed/updatestatus/${encodeURIComponent(scriptId)}?status=${Number(status)}`);

  async function listOptions(userId, slug, actionKey, { fieldKey, authId, existingFields = {}, version, search, paginate }) {
    const data = await apiCall(userId, 'POST', `${SERVICES}/${encodeURIComponent(slug)}/actions/${encodeURIComponent(actionKey)}/options`, {
      auth_id: authId,
      fieldKey,
      existingFields,
      ...(version ? { version } : {}),
      ...(search ? { search } : {}),
      ...(paginate != null ? { paginate } : {}),
    });
    return { options: data?.options || [], paginate: data?.paginate ?? null, hasMore: Boolean(data?.has_more), message: data?.message || null };
  }

  // No token: the script_id itself is the credential, which is why it stays on the server.
  async function runAction(scriptId, actionKey, inputData, { version } = {}) {
    if (!isScriptId(scriptId)) throw new ViaSocketError('Bad flow id');
    need();
    const { res, body } = await send(`${RUN}/func/${scriptId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: actionKey, ...(version ? { version } : {}), inputData }),
    });
    // A failed run answers 400 with { success:false, errorMsg:{ status, message } }; some apps wrap the reply in { success, data }.
    const envelope = body && typeof body === 'object' && typeof body.success === 'boolean' && 'data' in body;
    const failed = !res.ok || (envelope ? !body.success : body?.success === false);
    if (failed) {
      const why = body?.errorMsg?.message || body?.message;
      throw new ViaSocketError(`viaSocket could not run the action${typeof why === 'string' ? `: ${why.slice(0, 140)}` : ` (HTTP ${res.status})`}`, { status: res.status });
    }
    return envelope ? body.data : body;
  }

  return { configured, missing, embedToken, listActions, serviceIdFor, listConnections, revokeConnection, listFlows, findEnabledApp, enableApp, setFlowStatus, listOptions, runAction };
}
