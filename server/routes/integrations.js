import express from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware.js';
import { validateWebhookUrl } from '../lib/netguard.js';
import { EVENT_FIELDS, SHEET_HEADER, SLACK_TEMPLATE, testEvent } from '../lib/events.js';
import { fieldErrors } from '../lib/schemas.js';
import { MAX_ATTEMPTS } from '../outbox.js';
import { APP_KEYS, ConnectError } from '../connect.js';

const authIdSchema = z.object({ authId: z.string().min(4).max(300) });
const sheetsSchema = z.object({ spreadsheetId: z.string().max(300), spreadsheetName: z.string().max(200).optional(), gridId: z.string().max(300), gridName: z.string().max(200).optional() });
const slackSchema = z.object({ channelId: z.string().max(300), channelName: z.string().max(200).optional() });
const enabledSchema = z.object({ enabled: z.boolean() });

const urlSchema = z.object({ url: z.string({ error: 'Paste the flow URL' }).trim().min(1, 'Paste the flow URL').max(2000, 'That URL is too long') });

// The saved URL is a secret: it is never sent back, only a masked hint (host + dots).
const mask = (raw) => {
  try {
    return `https://${new URL(raw).host}/••••••••`;
  } catch {
    return '••••••••';
  }
};

/** Admin-only integrations API. Everything is scoped to the caller's own workspace. */
export function integrationRoutes({ db, auth, outbox, connect, config, testLimiter, viaLimiter = (_req, _res, next) => next() }) {
  const r = express.Router();
  const admin = [auth, requireRole('admin')];

  const view = (ws, user) => {
    const url = ws.integrations?.eventsFlowUrl;
    return {
      events: { configured: !!url, masked: url ? mask(url) : null, maxAttempts: MAX_ATTEMPTS },
      activity: db.data.activity
        .filter((a) => a.workspaceId === ws.id)
        .slice(-50)
        .reverse()
        .map(({ workspaceId, ...a }) => a),
      reference: { fields: EVENT_FIELDS, sheetHeader: SHEET_HEADER, slackTemplate: SLACK_TEMPLATE },
      adminName: user.name,
      connect: connect?.view(ws) ?? null, // Sheets / Slack through viaSocket: names and on/off only, never ids
    };
  };

  // ───────── Connect: Google Sheets and Slack through viaSocket ─────────
  const run = (handler) => async (req, res) => {
    try {
      await handler(req, res);
    } catch (e) {
      if (e instanceof ConnectError) return res.status(e.status).json({ error: e.code, message: e.message, ...e.extra });
      console.error('connect route failed:', e?.message);
      res.status(500).json({ error: 'internal_error' });
    }
  };
  const appOf = (req) => (APP_KEYS.includes(req.params.app) ? req.params.app : null);
  const bad = (res, error) => res.status(400).json({ error: 'validation_error', fields: fieldErrors(error) });
  const unknown = (res) => res.status(404).json({ error: 'not_found' });

  // The per-workspace embed token (the one value the browser may hold) plus what the Connect popup needs.
  r.get('/integrations/viasocket/token', viaLimiter, ...admin, run(async (req, res) => res.json(await connect.browserSetup(req.workspace))));

  r.post('/integrations/viasocket/:app/connected', viaLimiter, ...admin, run(async (req, res) => {
    const app = appOf(req);
    if (!app) return unknown(res);
    const parsed = authIdSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, parsed.error);
    await connect.connected(req.workspace, app, parsed.data.authId);
    res.json(view(req.workspace, req.user));
  }));

  r.get('/integrations/viasocket/:app/options', viaLimiter, ...admin, run(async (req, res) => {
    const app = appOf(req);
    if (!app) return unknown(res);
    const q = req.query;
    res.json(await connect.options(req.workspace, app, String(q.field || ''), { search: typeof q.search === 'string' ? q.search : undefined, paginate: typeof q.paginate === 'string' ? q.paginate : undefined, spreadsheetId: typeof q.spreadsheetId === 'string' ? q.spreadsheetId : undefined }));
  }));

  r.put('/integrations/viasocket/:app/target', viaLimiter, ...admin, run(async (req, res) => {
    const app = appOf(req);
    if (!app) return unknown(res);
    const parsed = (app === 'sheets' ? sheetsSchema : slackSchema).safeParse(req.body);
    if (!parsed.success) return bad(res, parsed.error);
    await connect.select(req.workspace, app, parsed.data);
    res.json(view(req.workspace, req.user));
  }));

  r.put('/integrations/viasocket/:app/enabled', viaLimiter, ...admin, run(async (req, res) => {
    const app = appOf(req);
    if (!app) return unknown(res);
    const parsed = enabledSchema.safeParse(req.body);
    if (!parsed.success) return bad(res, parsed.error);
    await connect.setEnabled(req.workspace, app, parsed.data.enabled);
    res.json(view(req.workspace, req.user));
  }));

  r.post('/integrations/viasocket/:app/test', testLimiter, ...admin, run(async (req, res) => {
    const app = appOf(req);
    if (!app) return unknown(res);
    const result = await connect.test(req.workspace, app, testEvent(req.user.name));
    res.json({ result, ...view(req.workspace, req.user) });
  }));

  r.delete('/integrations/viasocket/:app', viaLimiter, ...admin, run(async (req, res) => {
    const app = appOf(req);
    if (!app) return unknown(res);
    await connect.disconnect(req.workspace, app);
    res.json(view(req.workspace, req.user));
  }));

  r.get('/integrations', ...admin, (req, res) => res.json(view(req.workspace, req.user)));

  r.put('/integrations/events', ...admin, async (req, res) => {
    const parsed = urlSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'validation_error', fields: fieldErrors(parsed.error) });
    const check = await validateWebhookUrl(parsed.data.url, { allowPrivate: config.allowPrivateWebhooks });
    if (!check.ok) return res.status(400).json({ error: 'validation_error', fields: { url: check.reason } });
    req.workspace.integrations = { ...req.workspace.integrations, eventsFlowUrl: check.url.toString() };
    await db.commit();
    res.json(view(req.workspace, req.user));
  });

  r.delete('/integrations/events', ...admin, async (req, res) => {
    if (req.workspace.integrations) delete req.workspace.integrations.eventsFlowUrl;
    // pending retries for a removed URL are dropped (and logged) when they come due
    await db.commit();
    res.json(view(req.workspace, req.user));
  });

  r.post('/integrations/events/test', testLimiter, ...admin, async (req, res) => {
    if (!req.workspace.integrations?.eventsFlowUrl) return res.status(409).json({ error: 'no_url' });
    const result = await outbox.sendNow(req.workspace.id, testEvent(req.user.name));
    res.json({ result: { ok: result.ok, status: result.status, error: result.error }, ...view(req.workspace, req.user) });
  });

  return r;
}
