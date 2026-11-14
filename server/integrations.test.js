import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startApp, adminBody, employeeBody } from './test-helpers.js';
import { checkUrlShape, isBlockedAddress, validateWebhookUrl, guardedLookup } from './lib/netguard.js';
import { buildEvent, EVENT_FIELDS, SHEET_HEADER } from './lib/events.js';
import { Outbox, MAX_ATTEMPTS } from './outbox.js';
import { JsonDb } from './db.js';

// ───────── local mock endpoint: records every request, answers with a scripted status ─────────
async function mockEndpoint(script = () => 200) {
  const hits = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      hits.push({ method: req.method, path: req.url, type: req.headers['content-type'], body: JSON.parse(body || 'null') });
      const code = script(hits.length);
      res.writeHead(code, code >= 300 && code < 400 ? { location: 'http://127.0.0.1:1/elsewhere' } : {});
      res.end('{}');
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  server.unref(); // a failing assertion must not leave the test run hanging
  const url = `http://127.0.0.1:${server.address().port}/webhook/SECRET-TOKEN-123`;
  return { hits, url, close: () => new Promise((r) => (server.closeAllConnections?.(), server.close(r))) };
}
const DEV = { ALLOW_PRIVATE_WEBHOOKS: '1' };
const outcome = (over = {}) => ({ title: 'Ship the pricing page', deadline: '2999-01-01', impact: 4, criteria: ['Live on production'], proofPlan: 'Link to the page', ...over });

async function world(env = DEV) {
  const t = await startApp({ env });
  const admin = (await t.post('/api/auth/admin/signup', adminBody())).body;
  const eli = (await t.post('/api/auth/employee/signup', employeeBody(admin.workspace.inviteCode))).body;
  const put = (url, who = admin) => t.call('PUT', '/api/integrations/events', { token: who.token, body: { url } });
  return { t, admin, eli, put };
}

// ───────── SSRF guard (pure) ─────────
test('private, loopback, link-local and reserved addresses are blocked', () => {
  for (const ip of ['127.0.0.1', '127.9.9.9', '10.0.0.5', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '224.0.0.1', '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'not-an-ip'])
    assert.equal(isBlockedAddress(ip), true, ip);
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '2606:4700:4700::1111']) assert.equal(isBlockedAddress(ip), false, ip);
});

test('URL shape: https only, no credentials, no internal names or IP literals', () => {
  for (const bad of ['http://example.com/x', 'ftp://example.com/x', 'javascript:alert(1)', 'https://user:pw@example.com/x', 'https://127.0.0.1/x', 'https://localhost/x', 'https://[::1]/x', 'https://10.1.2.3/x', 'https://169.254.169.254/latest', 'https://2130706433/x', 'https://0x7f.0.0.1/x', 'https://printer.local/x', 'https://db.internal/x', 'https://intranet/x', 'nonsense', ''])
    assert.equal(checkUrlShape(bad).ok, false, bad);
  assert.equal(checkUrlShape('https://flow.example.com/webhook/abc').ok, true);
  // dev/test switch allows a local mock, and only that
  assert.equal(checkUrlShape('http://127.0.0.1:9/x', { allowPrivate: true }).ok, true);
  assert.equal(checkUrlShape('ftp://127.0.0.1/x', { allowPrivate: true }).ok, false);
});

test('a host name that RESOLVES to a private address is refused (and so is a rebind at connect time)', async () => {
  const toPrivate = async () => [{ address: '10.0.0.7', family: 4 }];
  const mixed = async () => [{ address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 }];
  const pub = async () => [{ address: '8.8.8.8', family: 4 }];
  assert.equal((await validateWebhookUrl('https://evil.example.com/x', { resolve: toPrivate })).ok, false);
  assert.equal((await validateWebhookUrl('https://evil.example.com/x', { resolve: mixed })).ok, false);
  assert.equal((await validateWebhookUrl('https://good.example.com/x', { resolve: pub })).ok, true);
  assert.equal((await validateWebhookUrl('https://nx.example.com/x', { resolve: async () => { throw new Error('ENOTFOUND'); } })).ok, false);
  const lookup = (resolve) => new Promise((res) => guardedLookup(resolve)('h.example.com', {}, (err, addr) => res({ err, addr })));
  assert.equal((await lookup(toPrivate)).err.code, 'EBLOCKED');
  assert.equal((await lookup(pub)).addr, '8.8.8.8');
});

// ───────── event payload (pure) ─────────
test('event payload is flat, has exactly the documented fields, and a ready Slack text', () => {
  const task = { id: 't1', title: 'Ship the pricing page', status: 'planned', impact: 4, deadline: '2999-01-01' };
  const e = buildEvent('task.created', task, 'Eli', { now: new Date('2030-01-02T03:04:05Z') });
  assert.deepEqual(Object.keys(e), SHEET_HEADER);
  assert.deepEqual(Object.keys(e), EVENT_FIELDS.map((f) => f.name));
  assert.equal(e.at, '2030-01-02T03:04:05.000Z');
  assert.match(e.text, /Eli planned “Ship the pricing page” \(impact 4\/5, due 2999-01-01\)/);
  for (const v of Object.values(e)) assert.ok(['string', 'number'].includes(typeof v));
  const m = buildEvent('task.status_changed', { ...task, status: 'in_progress' }, 'Eli', { from: 'planned' });
  assert.match(m.text, /Planned → In Progress/);
});

// ───────── outbox against the mock endpoint ─────────
test('a created outcome and a status change are POSTed to the events URL', async () => {
  const mock = await mockEndpoint();
  const { t, eli, put } = await world();
  assert.equal((await put(mock.url)).status, 200);
  const { task } = (await t.post('/api/tasks', outcome(), { token: eli.token })).body;
  await t.post(`/api/tasks/${task.id}/status`, { status: 'in_progress' }, { token: eli.token });
  await t.outbox.idle();
  assert.equal(mock.hits.length, 2);
  assert.equal(mock.hits[0].method, 'POST');
  assert.equal(mock.hits[0].type, 'application/json');
  assert.equal(mock.hits[0].path, '/webhook/SECRET-TOKEN-123');
  assert.deepEqual(Object.keys(mock.hits[0].body), SHEET_HEADER);
  assert.equal(mock.hits[0].body.event, 'task.created');
  assert.equal(mock.hits[0].body.owner, 'Eli Employee');
  assert.equal(mock.hits[0].body.taskId, task.id);
  assert.equal(mock.hits[1].body.event, 'task.status_changed');
  assert.equal(mock.hits[1].body.status, 'in_progress');
  assert.match(mock.hits[1].body.text, /Planned → In Progress/);
  await t.close();
  await mock.close();
});

test('no URL configured: nothing is queued and nothing is sent', async () => {
  const { t, eli } = await world();
  await t.post('/api/tasks', outcome(), { token: eli.token });
  assert.equal(t.db.data.outbox.length, 0);
  assert.equal(t.db.data.activity.length, 0);
  await t.close();
});

test('3 attempts with backoff: 500, 500, then 200 — each attempt logged with its status code', async () => {
  const mock = await mockEndpoint((n) => (n < 3 ? 500 : 200));
  const { t, eli, admin, put } = await world();
  await put(mock.url);
  await t.post('/api/tasks', outcome(), { token: eli.token });
  await t.outbox.idle();
  assert.equal(mock.hits.length, 3);
  const log = t.db.data.activity;
  assert.deepEqual(log.map((a) => [a.attempt, a.of, a.status, a.ok, a.willRetry]), [[1, 3, 500, false, true], [2, 3, 500, false, true], [3, 3, 200, true, false]]);
  assert.equal(t.db.data.outbox.length, 0);
  const api = (await t.get('/api/integrations', { token: admin.token })).body;
  assert.equal(api.activity.length, 3);
  assert.equal(api.activity[0].attempt, 3, 'newest first');
  await t.close();
  await mock.close();
});

test('it gives up after exactly 3 attempts and says so', async () => {
  const mock = await mockEndpoint(() => 503);
  const { t, eli, put } = await world();
  await put(mock.url);
  await t.post('/api/tasks', outcome(), { token: eli.token });
  await t.outbox.idle();
  assert.equal(mock.hits.length, MAX_ATTEMPTS);
  assert.deepEqual(t.db.data.activity.map((a) => a.willRetry), [true, true, false]);
  assert.equal(t.db.data.outbox.length, 0);
  await t.close();
  await mock.close();
});

test('redirects are not followed and count as a failure', async () => {
  const mock = await mockEndpoint(() => 302);
  const { t, eli, put } = await world();
  await put(mock.url);
  await t.post('/api/tasks', outcome(), { token: eli.token });
  await t.outbox.idle();
  assert.equal(mock.hits.length, 3, 'only the original URL was hit, three times');
  assert.ok(t.db.data.activity.every((a) => a.status === 302 && a.error === 'redirect'));
  await t.close();
  await mock.close();
});

test('an unreachable endpoint logs a network error (no status code) and still stops at 3', async () => {
  const mock = await mockEndpoint();
  const { t, eli, put } = await world();
  await put(mock.url);
  await mock.close(); // now nothing is listening
  await t.post('/api/tasks', outcome(), { token: eli.token });
  await t.outbox.idle();
  assert.equal(t.db.data.activity.length, 3);
  assert.ok(t.db.data.activity.every((a) => a.status === null && a.error === 'network'));
  await t.close();
});

test('pending retries survive a restart: a new Outbox on the same database finishes the job', async () => {
  const mock = await mockEndpoint();
  const { t, eli, put } = await world();
  await put(mock.url);
  t.outbox.stop(); // simulate the process going away before anything is sent
  await t.post('/api/tasks', outcome(), { token: eli.token });
  assert.equal(t.db.data.outbox.length, 1);
  await t.db.flush();
  const db2 = JsonDb.open(t.config.dbFile); // "restart": reload from disk
  assert.equal(db2.data.outbox.length, 1);
  const outbox2 = new Outbox({ db: db2, allowPrivate: true, backoffMs: [10, 10] });
  outbox2.start();
  await outbox2.idle();
  assert.equal(mock.hits.length, 1);
  assert.equal(db2.data.outbox.length, 0);
  outbox2.stop();
  await t.close();
  await mock.close();
});

test('removing the URL drops queued events instead of sending them anywhere', async () => {
  const mock = await mockEndpoint();
  const { t, eli, admin, put } = await world();
  await put(mock.url);
  t.outbox.stop();
  await t.post('/api/tasks', outcome(), { token: eli.token });
  await t.call('DELETE', '/api/integrations/events', { token: admin.token });
  t.outbox.start();
  await t.outbox.idle();
  assert.equal(mock.hits.length, 0);
  assert.equal(t.db.data.activity.at(-1).error, 'no_url');
  assert.equal((await t.get('/api/integrations', { token: admin.token })).body.events.configured, false);
  await t.close();
  await mock.close();
});

// ───────── API: secrecy, roles, validation ─────────
test('the saved URL is never returned or logged: only a masked hint', async () => {
  const mock = await mockEndpoint();
  const { t, eli, admin, put } = await world();
  const saved = await put(mock.url);
  assert.equal(saved.body.events.configured, true);
  assert.match(saved.body.events.masked, /^https:\/\/127\.0\.0\.1:\d+\/••••••••$/);
  await t.post('/api/tasks', outcome(), { token: eli.token });
  await t.outbox.idle();
  await t.outbox.sendNow(admin.workspace.id, { event: 'x', taskId: 'x', title: 'x' });
  const everything = JSON.stringify([saved.body, (await t.get('/api/integrations', { token: admin.token })).body, (await t.post('/api/integrations/events/test', {}, { token: admin.token })).body, t.db.data.activity, t.db.data.outbox]);
  assert.ok(!everything.includes('SECRET-TOKEN-123'), 'token leaked into a response, the log or the outbox');
  assert.ok(!everything.includes('webhook'), 'path leaked');
  const me = JSON.stringify((await t.get('/api/me', { token: admin.token })).body);
  assert.ok(!me.includes('SECRET-TOKEN-123'));
  await t.close();
  await mock.close();
});

test('only the admin of a workspace can read or change its integrations (tenant isolation)', async () => {
  const mock = await mockEndpoint();
  const { t, eli, admin, put } = await world();
  await put(mock.url);
  assert.equal((await t.get('/api/integrations', { token: eli.token })).status, 403);
  assert.equal((await put('https://example.com/x', eli)).status, 403);
  assert.equal((await t.post('/api/integrations/events/test', {}, { token: eli.token })).status, 403);
  assert.equal((await t.get('/api/integrations')).status, 401);
  const other = (await t.post('/api/auth/admin/signup', adminBody({ workspaceName: 'Other Co' }))).body;
  const theirs = (await t.get('/api/integrations', { token: other.token })).body;
  assert.equal(theirs.events.configured, false);
  assert.equal(theirs.activity.length, 0);
  // their tasks do not fire events at Acme's URL
  const stranger = (await t.post('/api/auth/employee/signup', employeeBody(other.workspace.inviteCode))).body;
  await t.post('/api/tasks', outcome(), { token: stranger.token });
  await t.outbox.idle();
  assert.equal(mock.hits.length, 0);
  assert.equal((await t.post('/api/integrations/events/test', {}, { token: other.token })).status, 409);
  void admin;
  await t.close();
  await mock.close();
});

test('production-style config refuses http, private and loopback targets when saving', async () => {
  const { t, put } = await world({}); // ALLOW_PRIVATE_WEBHOOKS off
  for (const bad of ['http://example.com/x', 'https://127.0.0.1/x', 'https://localhost/x', 'https://10.0.0.5/hook', 'https://169.254.169.254/', 'https://[::1]/x', 'https://user:pw@example.com/x', 'not a url']) {
    const r = await put(bad);
    assert.equal(r.status, 400, bad);
    assert.ok(r.body.fields.url, bad);
  }
  assert.equal(t.db.workspaceById((await t.db.data.workspaces[0]).id).integrations, undefined, 'nothing was stored');
  assert.equal((await put('')).status, 400);
  await t.close();
});

test('production mode ignores the dev switch for private webhooks', async () => {
  const { loadConfig } = await import('./config.js');
  const prod = loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), DATA_DIR: (await import('node:os')).tmpdir(), ALLOW_PRIVATE_WEBHOOKS: '1' });
  assert.equal(prod.allowPrivateWebhooks, false);
});

test('"Send test event" posts a test.ping, logs it, and reports the status code', async () => {
  const mock = await mockEndpoint((n) => (n === 1 ? 200 : 500));
  const { t, admin, put } = await world();
  assert.equal((await t.post('/api/integrations/events/test', {}, { token: admin.token })).status, 409, 'no URL yet');
  await put(mock.url);
  const ok = await t.post('/api/integrations/events/test', {}, { token: admin.token });
  assert.deepEqual(ok.body.result, { ok: true, status: 200, error: null });
  assert.equal(mock.hits[0].body.event, 'test.ping');
  assert.deepEqual(Object.keys(mock.hits[0].body), SHEET_HEADER);
  const bad = await t.post('/api/integrations/events/test', {}, { token: admin.token });
  assert.deepEqual(bad.body.result, { ok: false, status: 500, error: 'http' });
  assert.equal(bad.body.activity[0].status, 500);
  assert.equal(bad.body.activity[1].status, 200);
  await t.close();
  await mock.close();
});

test('the integrations settings are stored in the data directory (db.json), nowhere else', async () => {
  const mock = await mockEndpoint();
  const { t, put } = await world();
  await put(mock.url);
  await t.db.flush();
  const fs = await import('node:fs');
  assert.ok(fs.readFileSync(t.config.dbFile, 'utf8').includes('SECRET-TOKEN-123'), 'saved inside DATA_DIR/db.json');
  assert.ok(t.config.dbFile.startsWith(t.config.dataDir));
  await t.close();
  await mock.close();
});
