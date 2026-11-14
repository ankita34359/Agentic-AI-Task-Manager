import express from 'express';
import { z } from 'zod';
import { requireRole } from '../middleware.js';
import { validateWebhookUrl } from '../lib/netguard.js';
import { EVENT_FIELDS, SHEET_HEADER, SLACK_TEMPLATE, testEvent } from '../lib/events.js';
import { fieldErrors } from '../lib/schemas.js';
import { MAX_ATTEMPTS } from '../outbox.js';

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
export function integrationRoutes({ db, auth, outbox, config, testLimiter }) {
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
    };
  };

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
