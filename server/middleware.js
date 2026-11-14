import { verifyToken } from './lib/auth.js';

/**
 * Authenticate a request from `Authorization: Bearer <jwt>`.
 * The database is the source of truth: the user must still exist and the token's role/workspace
 * must match the stored ones, so a deleted user or a tampered claim is rejected even with a valid signature.
 */
export const authenticate =
  ({ db, config }) =>
  (req, res, next) => {
    const match = /^Bearer (.+)$/.exec(req.headers.authorization || '');
    if (!match) return res.status(401).json({ error: 'unauthorized' });
    let payload;
    try {
      payload = verifyToken(match[1], config.jwtSecret);
    } catch {
      return res.status(401).json({ error: 'unauthorized' });
    }
    const user = db.userById(payload.sub);
    if (!user || user.workspaceId !== payload.ws || user.role !== payload.role) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    req.user = user;
    req.workspace = db.workspaceById(user.workspaceId);
    next();
  };

/** Must come after authenticate(). */
export const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'forbidden' });
    next();
  };

export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, workspaceId: u.workspaceId, createdAt: u.createdAt });
