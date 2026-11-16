import crypto from 'node:crypto';
import { APPS, ViaSocketError, isAuthId } from './lib/viasocket.js';
import { SHEET_HEADER } from './lib/events.js';

/**
 * "Connect" integrations: Google Sheets and Slack through viaSocket's apps API.
 *
 * Per-workspace state lives in `workspace.integrations.connect` inside db.json (server side only):
 *   sheets: { authId, scriptId, spreadsheetId, spreadsheetName, gridId, gridName, columns, missingColumns, enabled, connectedAt }
 *   slack:  { authId, scriptId, channelId, channelName, enabled, connectedAt }
 * `authId` and `scriptId` are credentials. They never appear in any view, response, log or error message.
 */

export const APP_KEYS = Object.keys(APPS); // ['sheets', 'slack']
const LOG_CAP = 1000;
const LABEL = { sheets: 'Google Sheets', slack: 'Slack' };

const vsUser = (ws) => `ol-ws-${ws.id}`; // viaSocket's per-user id: one connection set per workspace, whoever the admin is

export class ConnectError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code);
    Object.assign(this, { status, code, extra });
  }
}

/** Removes anything that could be a credential from text that may reach a response or the activity log. */
export function scrub(text, secrets = []) {
  let out = String(text ?? '');
  for (const s of secrets) if (typeof s === 'string' && s.length >= 4) out = out.split(s).join('•••');
  out = out.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g, '•••'); // JWTs (embed tokens)
  out = out.replace(/\/func\/[A-Za-z0-9_-]+/g, '/func/•••'); // run URLs carry the script_id
  return out.replace(/\s+/g, ' ').trim().slice(0, 160);
}

const clean = (v, max = 300) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '');

export class Connect {
  constructor({ db, via, now = () => Date.now() }) {
    Object.assign(this, { db, via, now });
    this.pending = new Set();
  }

  // ───────── state ─────────
  store(ws) {
    ws.integrations ??= {};
    ws.integrations.connect ??= {};
    return ws.integrations.connect;
  }
  slot(ws, app) {
    return ws.integrations?.connect?.[app] || null;
  }
  ready(ws, app) {
    const s = this.slot(ws, app);
    if (!s?.scriptId || !s.authId) return false;
    if (app === 'sheets') return !!(s.spreadsheetId && s.gridId && s.columns && SHEET_HEADER.every((f) => s.columns[f]));
    return !!s.channelId;
  }

  /** What the browser may see. No ids that act as credentials. */
  view(ws) {
    const out = { configured: this.via.configured, missing: this.via.missing };
    for (const app of APP_KEYS) {
      const s = this.slot(ws, app);
      out[app] = {
        label: LABEL[app],
        connected: !!s?.authId,
        ready: this.ready(ws, app),
        enabled: !!s?.enabled && this.ready(ws, app),
        ...(app === 'sheets'
          ? { spreadsheetName: s?.spreadsheetName || null, sheetName: s?.gridName || null, missingColumns: s?.missingColumns || [], picked: !!(s?.spreadsheetId && s?.gridId) }
          : { channelName: s?.channelName || null, picked: !!s?.channelId }),
      };
    }
    return out;
  }

  secrets(ws) {
    const out = [];
    for (const app of APP_KEYS) {
      const s = this.slot(ws, app);
      if (s) out.push(s.authId, s.scriptId);
    }
    return out;
  }

  fail(ws, e) {
    if (e instanceof ConnectError) return e;
    if (e instanceof ViaSocketError && e.notConfigured) return new ConnectError(503, 'viasocket_not_configured', e.message, { missing: this.via.missing });
    return new ConnectError(502, 'viasocket_failed', scrub(e?.message || 'viaSocket failed', this.secrets(ws)));
  }

  // ───────── browser setup ─────────
  /** Token for the Connect popup plus what the popup needs per app (service id, action id). */
  async browserSetup(ws) {
    try {
      const user = vsUser(ws);
      const token = this.via.embedToken(user);
      const apps = {};
      for (const app of APP_KEYS) {
        const def = APPS[app];
        const listing = await this.via.listActions(user, def.slug);
        const actionId = listing.actions?.find((a) => a.key === def.action)?.action_id || def.actionId;
        apps[app] = { slug: def.slug, serviceId: listing.service_id, actionId };
      }
      return { token, apps };
    } catch (e) {
      throw this.fail(ws, e);
    }
  }

  /** The popup reported a connection. Trust nothing from the browser: the id must be one viaSocket lists for this workspace. */
  async connected(ws, app, authId) {
    const def = APPS[app];
    try {
      if (!isAuthId(authId)) throw new ConnectError(400, 'validation_error', 'That connection id does not look right.');
      const user = vsUser(ws);
      const mine = (await this.via.listConnections(user)).find((c) => c?.id === authId);
      if (!mine) throw new ConnectError(409, 'unknown_connection', 'viaSocket does not list that connection for this workspace. Press Connect again.');
      const scriptId = (await this.via.findEnabledApp(user, def.slug)) || (await this.via.enableApp(user, def.slug, authId));
      if (!scriptId) throw new ConnectError(502, 'viasocket_failed', 'viaSocket did not enable the app.');
      const cur = this.slot(ws, app);
      const same = cur?.authId === authId;
      this.store(ws)[app] = { ...(same ? cur : { enabled: false }), authId, scriptId, connectedAt: new Date(this.now()).toISOString() };
      await this.db.commit();
      return this.view(ws);
    } catch (e) {
      throw this.fail(ws, e);
    }
  }

  // ───────── pickers ─────────
  async options(ws, app, field, { search, paginate, spreadsheetId } = {}) {
    const s = this.slot(ws, app);
    if (!s?.authId) throw new ConnectError(409, 'not_connected', `${LABEL[app]} is not connected yet.`);
    const def = APPS[app];
    const map = {
      spreadsheet: ['spreadsheet_Id', {}],
      sheet: ['grid_Id', { spreadsheet_Id: spreadsheetId }],
      channel: ['destination.channel_id', { destination: { messageto: 'channel' } }],
    };
    const pick = map[field];
    if (!pick || (app === 'sheets' && field === 'channel') || (app === 'slack' && field !== 'channel')) throw new ConnectError(400, 'validation_error', 'Unknown list.');
    if (field === 'sheet' && !clean(spreadsheetId)) throw new ConnectError(400, 'validation_error', 'Choose a spreadsheet first.');
    try {
      const out = await this.via.listOptions(vsUser(ws), def.slug, def.action, { fieldKey: pick[0], authId: s.authId, existingFields: pick[1], version: def.version, search: clean(search, 100) || undefined, paginate: paginate ?? undefined });
      const options = out.options.filter((o) => o && o.value != null).map((o) => ({ label: clean(String(o.label ?? o.value), 120), value: String(o.value) }));
      return { options, paginate: out.paginate, hasMore: out.hasMore, message: out.message ? clean(String(out.message), 200) : null };
    } catch (e) {
      throw this.fail(ws, e);
    }
  }

  /** The admin's pick from the dropdowns. Sheets also reads the sheet's column list and maps our nine fields onto it. */
  async select(ws, app, body) {
    const s = this.slot(ws, app);
    if (!s?.authId) throw new ConnectError(409, 'not_connected', `${LABEL[app]} is not connected yet.`);
    if (app === 'slack') {
      const channelId = clean(body.channelId);
      if (!channelId) throw new ConnectError(400, 'validation_error', 'Choose a channel.', { fields: { channelId: 'Choose a channel' } });
      Object.assign(s, { channelId, channelName: clean(body.channelName, 120) || channelId });
      await this.db.commit();
      return this.view(ws);
    }
    const spreadsheetId = clean(body.spreadsheetId);
    const gridId = clean(body.gridId);
    if (!spreadsheetId || !gridId) throw new ConnectError(400, 'validation_error', 'Choose a spreadsheet and a worksheet.', { fields: { spreadsheetId: spreadsheetId ? undefined : 'Choose a spreadsheet', gridId: gridId ? undefined : 'Choose a worksheet' } });
    const def = APPS.sheets;
    let cols;
    try {
      cols = await this.via.listOptions(vsUser(ws), def.slug, def.action, { fieldKey: 'column_selected', authId: s.authId, existingFields: { spreadsheet_Id: spreadsheetId, grid_Id: gridId, column_key: true }, version: def.version });
    } catch (e) {
      throw this.fail(ws, e);
    }
    // Our field name -> the option value viaSocket wants. Matched on the column title (row 1), case-insensitively.
    const find = (name) => cols.options.find((o) => String(o.label ?? '').trim().toLowerCase() === name.toLowerCase() || String(o.value ?? '').trim().toLowerCase() === name.toLowerCase());
    const columns = {};
    const missingColumns = [];
    for (const f of SHEET_HEADER) {
      const hit = find(f);
      if (hit) columns[f] = String(hit.value);
      else missingColumns.push(f);
    }
    Object.assign(s, { spreadsheetId, spreadsheetName: clean(body.spreadsheetName, 120) || 'Spreadsheet', gridId, gridName: clean(body.gridName, 120) || 'Sheet', columns: missingColumns.length ? {} : columns, missingColumns });
    if (missingColumns.length) s.enabled = false;
    await this.db.commit();
    return this.view(ws);
  }

  async setEnabled(ws, app, enabled) {
    const s = this.slot(ws, app);
    if (!s?.authId) throw new ConnectError(409, 'not_connected', `${LABEL[app]} is not connected yet.`);
    if (enabled && !this.ready(ws, app)) throw new ConnectError(409, 'not_ready', app === 'sheets' ? 'Choose a spreadsheet and worksheet whose first row has all the column titles.' : 'Choose a channel first.');
    s.enabled = !!enabled;
    await this.db.commit();
    return this.view(ws);
  }

  async disconnect(ws, app) {
    const s = this.slot(ws, app);
    if (s?.authId) {
      try {
        await this.via.revokeConnection(vsUser(ws), s.authId); // best effort: ours is cleared either way
      } catch (e) {
        console.error(`viaSocket revoke failed (${app}): ${scrub(e?.message, this.secrets(ws))}`);
      }
    }
    if (ws.integrations?.connect) delete ws.integrations.connect[app];
    await this.db.commit();
    return this.view(ws);
  }

  // ───────── sending ─────────
  inputFor(ws, app, payload) {
    const s = this.slot(ws, app);
    if (app === 'slack') return { destination: { messageto: 'channel', channel_id: [s.channelId] }, markdown_content: String(payload.text ?? '') };
    const column_name = {};
    for (const f of SHEET_HEADER) column_name[s.columns[f]] = String(payload[f] ?? '');
    return { spreadsheet_Id: s.spreadsheetId, grid_Id: s.gridId, column_key: true, column_selected: SHEET_HEADER.map((f) => s.columns[f]), column_name };
  }

  log(ws, app, payload, { ok, error, detail }) {
    const a = this.db.data.activity;
    a.push({ id: crypto.randomUUID(), at: new Date(this.now()).toISOString(), workspaceId: ws.id, via: app, event: payload.event, taskId: payload.taskId, title: payload.title, attempt: 1, of: 1, ok, status: null, error: ok ? null : error, detail: ok ? null : detail, willRetry: false });
    if (a.length > LOG_CAP) a.splice(0, a.length - LOG_CAP);
  }

  /** One send to one app. Never throws; the outcome goes to the Activity log. */
  async sendOne(ws, app, payload) {
    const s = this.slot(ws, app);
    const def = APPS[app];
    try {
      await this.via.runAction(s.scriptId, def.action, this.inputFor(ws, app, payload), { version: def.version });
      this.log(ws, app, payload, { ok: true });
      return { ok: true };
    } catch (e) {
      const detail = scrub(e?.message || 'failed', this.secrets(ws));
      this.log(ws, app, payload, { ok: false, error: 'viasocket', detail });
      return { ok: false, detail };
    }
  }

  /**
   * Called AFTER the task is saved. Fire and forget: the returned promise never rejects, and callers do not await it
   * before answering the employee. Does nothing (and logs nothing) for apps that are off or not set up.
   */
  dispatch(workspaceId, payload) {
    const ws = this.db.workspaceById(workspaceId);
    if (!ws) return Promise.resolve();
    const targets = APP_KEYS.filter((app) => this.slot(ws, app)?.enabled && this.ready(ws, app));
    if (!targets.length) return Promise.resolve();
    const job = (async () => {
      try {
        await Promise.all(targets.map((app) => this.sendOne(ws, app, payload)));
        await this.db.commit();
      } catch (e) {
        console.error('connect dispatch failed:', scrub(e?.message, this.secrets(ws)));
      }
    })();
    this.pending.add(job);
    job.finally(() => this.pending.delete(job));
    return job;
  }

  /** Admin's "Send test" button: one real row / message, only to the app asked for. */
  async test(ws, app, payload) {
    if (!this.ready(ws, app)) throw new ConnectError(409, 'not_ready', 'Finish choosing the spreadsheet/worksheet or channel first.');
    const r = await this.sendOne(ws, app, payload);
    await this.db.commit();
    return r;
  }

  async idle(timeoutMs = 5000) {
    const end = Date.now() + timeoutMs;
    while (this.pending.size && Date.now() < end) await Promise.allSettled([...this.pending]);
  }
}
