import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Optional local .env (gitignored). Real environment variables always win.
// (process.loadEnvFile needs Node >= 20.12; hosts that run older Node simply rely on real env vars.)
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(path.join(ROOT, '.env'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

function parsePort(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n < 65536 ? n : 3000;
}

function resolveJwtSecret(env, isProd, dataDir) {
  const fromEnv = (env.JWT_SECRET || '').trim();
  if (isProd) {
    if (fromEnv.length < 32) {
      throw new Error('JWT_SECRET is required in production and must be at least 32 characters.');
    }
    return fromEnv;
  }
  if (fromEnv) return fromEnv;
  // Development convenience: persist a random secret next to the data (gitignored).
  const file = path.join(dataDir, '.jwt-secret');
  try {
    return fs.readFileSync(file, 'utf8').trim();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

/**
 * Build the runtime config from environment variables.
 * Every path the app writes to derives from DATA_DIR — never from the code directory —
 * so a persistent volume can be mounted there in production.
 */
export function loadConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const dataDir = path.resolve(ROOT, env.DATA_DIR || './server/data');
  const uploadsDir = path.join(dataDir, 'uploads');

  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.accessSync(dataDir, fs.constants.W_OK);
  } catch (err) {
    throw new Error(`DATA_DIR "${dataDir}" is not writable (${err.code || err.message}).`);
  }

  return Object.freeze({
    isProd,
    port: parsePort(env.PORT),
    dataDir,
    dbFile: path.join(dataDir, 'db.json'),
    uploadsDir,
    clientDist: path.join(ROOT, 'client', 'dist'),
    jwtSecret: resolveJwtSecret(env, isProd, dataDir),
    publicBaseUrl: (env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, ''),
  });
}
