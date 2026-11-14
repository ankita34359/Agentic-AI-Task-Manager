import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const COST = 10;
const TOKEN_TTL = '7d';

export const hashPassword = (plain) => bcrypt.hash(plain, COST);

// Compared against when the email is unknown, so "no such user" and "wrong password"
// take about the same time and return the same error.
let dummyHash;
export async function verifyPassword(plain, hash) {
  if (!hash) {
    dummyHash ??= await bcrypt.hash(crypto.randomBytes(16).toString('hex'), COST);
    await bcrypt.compare(plain, dummyHash);
    return false;
  }
  return bcrypt.compare(plain, hash);
}

export function signToken(user, secret) {
  return jwt.sign({ role: user.role, ws: user.workspaceId }, secret, { algorithm: 'HS256', subject: user.id, expiresIn: TOKEN_TTL });
}

/** Throws on a bad/expired/tampered token. Only HS256 is accepted (blocks alg:none and key-confusion tricks). */
export function verifyToken(token, secret) {
  return jwt.verify(token, secret, { algorithms: ['HS256'] });
}

// ───────── invite codes ─────────
// 8 symbols from a 32-char alphabet without look-alikes (no I, O, 0, 1) → ~1.1 trillion codes.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const normalizeInvite = (input) => String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const formatInvite = (normalized) => `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
export const isValidInviteShape = (normalized) => normalized.length === 8 && [...normalized].every((c) => ALPHABET.includes(c));

export function generateInviteCode(db) {
  for (let attempt = 0; attempt < 20; attempt++) {
    let code = '';
    for (let i = 0; i < 8; i++) code += ALPHABET[crypto.randomInt(ALPHABET.length)];
    if (!db.workspaceByInvite(code)) return code;
  }
  throw new Error('could not generate a unique invite code');
}
