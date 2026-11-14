import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ol-test-'));

async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.close();
    server.closeAllConnections?.();
  }
}

test('DATA_DIR is honoured and created, including uploads/', () => {
  const dir = path.join(tmp(), 'nested', 'data');
  const cfg = loadConfig({ DATA_DIR: dir, NODE_ENV: 'development', JWT_SECRET: 'x'.repeat(40) });
  assert.equal(cfg.dataDir, dir);
  assert.equal(cfg.dbFile, path.join(dir, 'db.json'));
  assert.ok(fs.statSync(cfg.uploadsDir).isDirectory());
});

test('production refuses to start without a strong JWT_SECRET', () => {
  const DATA_DIR = tmp();
  assert.throws(() => loadConfig({ NODE_ENV: 'production', DATA_DIR }), /JWT_SECRET/);
  assert.throws(() => loadConfig({ NODE_ENV: 'production', DATA_DIR, JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.doesNotThrow(() => loadConfig({ NODE_ENV: 'production', DATA_DIR, JWT_SECRET: 'y'.repeat(32) }));
});

test('development generates a persistent JWT secret inside DATA_DIR', () => {
  const DATA_DIR = tmp();
  const a = loadConfig({ DATA_DIR });
  const b = loadConfig({ DATA_DIR });
  assert.ok(a.jwtSecret.length >= 64);
  assert.equal(a.jwtSecret, b.jwtSecret);
  assert.ok(fs.existsSync(path.join(DATA_DIR, '.jwt-secret')));
});

test('invalid PORT falls back to 3000', () => {
  assert.equal(loadConfig({ DATA_DIR: tmp(), PORT: 'abc' }).port, 3000);
  assert.equal(loadConfig({ DATA_DIR: tmp(), PORT: '8080' }).port, 8080);
});

test('health, JSON 404 for unknown API routes, security headers', async () => {
  const app = createApp(loadConfig({ DATA_DIR: tmp() }));
  await withServer(app, async (base) => {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);
    assert.ok(health.headers.get('content-security-policy'));
    assert.equal(health.headers.get('x-powered-by'), null);

    const missing = await fetch(`${base}/api/nope`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: 'not_found' });

    const bad = await fetch(`${base}/api/health`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{' });
    assert.equal(bad.status, 400);
  });
});

test('serves built client with SPA fallback and cache headers', async () => {
  const dist = tmp();
  fs.mkdirSync(path.join(dist, 'assets'));
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>spa</title>');
  fs.writeFileSync(path.join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
  const cfg = { ...loadConfig({ DATA_DIR: tmp() }), clientDist: dist };
  await withServer(createApp(cfg), async (base) => {
    const deep = await fetch(`${base}/admin/overview`);
    assert.equal(deep.status, 200);
    assert.match(await deep.text(), /<title>spa<\/title>/);

    const asset = await fetch(`${base}/assets/app-abc123.js`);
    assert.match(asset.headers.get('cache-control'), /immutable/);
  });
});
