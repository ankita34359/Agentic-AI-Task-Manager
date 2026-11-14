import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { JsonDb } from './db.js';

export const tmpDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ol-test-'));

// Generous limits so ordinary tests never trip the rate limiter (rate-limit tests pass their own).
export const OPEN_LIMITS = {
  login: { windowMs: 60_000, limit: 10_000 },
  signup: { windowMs: 60_000, limit: 10_000 },
  invite: { windowMs: 60_000, limit: 10_000 },
};

/** Boots the real app on a random port with an isolated DATA_DIR. */
export async function startApp({ limits = OPEN_LIMITS, dataDir = tmpDir(), env = {} } = {}) {
  const config = loadConfig({ DATA_DIR: dataDir, JWT_SECRET: 'test-secret-'.repeat(4), ...env });
  const db = JsonDb.open(config.dbFile);
  const app = createApp(config, { db, limits });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  async function call(method, url, { token, body, headers = {} } = {}) {
    const res = await fetch(base + url, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* no body */
    }
    return { status: res.status, body: json, headers: res.headers };
  }

  return {
    base,
    config,
    db,
    dataDir,
    call,
    get: (u, o) => call('GET', u, o),
    post: (u, body, o) => call('POST', u, { ...o, body: body ?? {} }),
    async close() {
      await db.flush();
      server.close();
      server.closeAllConnections?.();
    },
  };
}

let n = 0;
export const adminBody = (over = {}) => ({ workspaceName: 'Acme Inc', name: 'Ada Admin', email: `ada${++n}@acme.test`, password: 'correct-horse-battery', ...over });
export const employeeBody = (inviteCode, over = {}) => ({ inviteCode, name: 'Eli Employee', email: `eli${++n}@acme.test`, password: 'another-good-password', ...over });
