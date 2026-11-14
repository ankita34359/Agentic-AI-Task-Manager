import crypto from 'node:crypto';
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate, publicUser, requireRole } from '../middleware.js';
import { formatInvite, generateInviteCode, hashPassword, isValidInviteShape, normalizeInvite, signToken, verifyPassword } from '../lib/auth.js';
import { taskRoutes } from './tasks.js';
import { integrationRoutes } from './integrations.js';
import { adminSignupSchema, employeeSignupSchema, fieldErrors, loginSchema } from '../lib/schemas.js';

export const DEFAULT_LIMITS = {
  login: { windowMs: 15 * 60_000, limit: 20, skipSuccessful: true }, // failed logins per IP
  signup: { windowMs: 60 * 60_000, limit: 20 },
  invite: { windowMs: 15 * 60_000, limit: 60 }, // invite-code lookups per IP (the code space is huge, this is belt and braces)
  integrations: { windowMs: 60_000, limit: 20 }, // "Send test event" clicks per IP
};

const limiter = ({ windowMs, limit, skipSuccessful }) =>
  rateLimit({
    windowMs,
    limit,
    skipSuccessfulRequests: !!skipSuccessful,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) => res.status(429).json({ error: 'rate_limited' }),
  });

export function apiRoutes({ db, config, outbox, limits = DEFAULT_LIMITS }) {
  const r = express.Router();
  const auth = authenticate({ db, config });

  // The invite code is only ever shown to the admin of that workspace.
  const workspaceView = (ws, user) => ({
    id: ws.id,
    name: ws.name,
    createdAt: ws.createdAt,
    ...(user.role === 'admin' ? { inviteCode: formatInvite(ws.inviteCode) } : {}),
  });
  const session = (user, ws) => ({ token: signToken(user, config.jwtSecret), user: publicUser(user), workspace: workspaceView(ws, user) });
  const invalid = (res, error) => res.status(400).json({ error: 'validation_error', fields: fieldErrors(error) });

  // ───────── sign-up / login ─────────
  r.post('/auth/admin/signup', limiter(limits.signup), async (req, res) => {
    const parsed = adminSignupSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const { workspaceName, name, email, password, tzOffset } = parsed.data;

    const passwordHash = await hashPassword(password);
    // From here to commit() everything is synchronous, so two racing requests can't both claim an email.
    if (db.userByEmail(email)) return res.status(409).json({ error: 'email_taken', fields: { email: 'That email already has an account' } });

    const now = new Date().toISOString();
    const ws = { id: crypto.randomUUID(), name: workspaceName, inviteCode: generateInviteCode(db), createdAt: now };
    const user = { id: crypto.randomUUID(), workspaceId: ws.id, role: 'admin', name, email, passwordHash, tzOffset, createdAt: now };
    db.data.workspaces.push(ws);
    db.data.users.push(user);
    await db.commit();
    res.status(201).json(session(user, ws));
  });

  r.post('/auth/employee/signup', limiter(limits.signup), async (req, res) => {
    const parsed = employeeSignupSchema.safeParse(req.body);
    if (!parsed.success) return invalid(res, parsed.error);
    const { inviteCode, name, email, password, tzOffset } = parsed.data;
    const code = normalizeInvite(inviteCode);
    const badInvite = () => res.status(400).json({ error: 'invalid_invite', fields: { inviteCode: 'That invite code does not match any workspace' } });
    if (!isValidInviteShape(code) || !db.workspaceByInvite(code)) return badInvite();

    const passwordHash = await hashPassword(password);
    const ws = db.workspaceByInvite(code); // re-check: the admin may have regenerated the code while we hashed
    if (!ws) return badInvite();
    if (db.userByEmail(email)) return res.status(409).json({ error: 'email_taken', fields: { email: 'That email already has an account' } });

    const user = { id: crypto.randomUUID(), workspaceId: ws.id, role: 'employee', name, email, passwordHash, tzOffset, createdAt: new Date().toISOString() };
    db.data.users.push(user);
    await db.commit();
    res.status(201).json(session(user, ws));
  });

  // Live check while the employee types the code. Returns only the workspace name.
  r.get('/auth/invite/:code', limiter(limits.invite), (req, res) => {
    const code = normalizeInvite(req.params.code);
    const ws = isValidInviteShape(code) ? db.workspaceByInvite(code) : null;
    res.json(ws ? { valid: true, workspaceName: ws.name } : { valid: false });
  });

  r.post('/auth/login', limiter(limits.login), async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(401).json({ error: 'invalid_credentials' });
    const { email, password } = parsed.data;
    const user = db.userByEmail(email);
    const ok = await verifyPassword(password, user?.passwordHash);
    // Same answer for "no such user" and "wrong password".
    if (!user || !ok) return res.status(401).json({ error: 'invalid_credentials' });
    res.json(session(user, db.workspaceById(user.workspaceId)));
  });

  // ───────── authenticated ─────────
  r.get('/me', auth, (req, res) => {
    res.json({ user: publicUser(req.user), workspace: workspaceView(req.workspace, req.user) });
  });

  // Admin only. Every query is scoped to the caller's own workspace (tenant isolation).
  r.get('/team', auth, requireRole('admin'), (req, res) => {
    const members = db.usersInWorkspace(req.user.workspaceId).map(publicUser);
    res.json({ members });
  });

  r.post('/workspace/invite/regenerate', auth, requireRole('admin'), async (req, res) => {
    req.workspace.inviteCode = generateInviteCode(db);
    await db.commit();
    res.json({ inviteCode: formatInvite(req.workspace.inviteCode) });
  });

  r.use(taskRoutes({ db, auth, outbox }));
  r.use(integrationRoutes({ db, auth, outbox, config, testLimiter: limiter(limits.integrations ?? DEFAULT_LIMITS.integrations) }));

  return r;
}
