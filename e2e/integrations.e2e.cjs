// Browser end-to-end test for the viaSocket events outbox + Integrations page (milestone 4).
// Needs Playwright + a built client:  npm run build && NODE_PATH=$(npm root -g) node e2e/integrations.e2e.cjs
// Boots its own app on :8092 (development mode, ALLOW_PRIVATE_WEBHOOKS=1 so the webhook can be a local mock) and a mock endpoint.
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const ROOT = path.resolve(__dirname, '..');
const SP = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'ol-e2e-shots');
fs.mkdirSync(path.join(SP, 'shots'), { recursive: true });
const DATA = '/tmp/ol-e2e-int-data'; const PORT = 8092; const APP = `http://localhost:${PORT}`;
fs.rmSync(DATA, { recursive: true, force: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) process.exitCode = 1; };

const hits = []; let status = 200;
const mock = http.createServer((req, res) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { hits.push(JSON.parse(b || 'null')); res.writeHead(status); res.end('{}'); }); });
const SECRET = 'E2E-SECRET-TOKEN-777';

const srv = spawn('node', ['scripts/start.js'], { cwd: ROOT, env: { ...process.env, NODE_ENV: 'development', ALLOW_PRIVATE_WEBHOOKS: '1', JWT_SECRET: 'e2e-secret-'.repeat(4), DATA_DIR: DATA, PORT: String(PORT) }, stdio: 'ignore' });
async function ready() { for (let i = 0; i < 40; i++) { try { if ((await fetch(APP + '/api/health')).ok) return; } catch {} await wait(250); } throw new Error('server not ready'); }
const api = async (m, p, b, t) => { const r = await fetch(APP + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };
const outcome = (t) => ({ title: t, deadline: '2999-01-01', impact: 4, criteria: ['Live on production'], proofPlan: 'A link to the page' });

(async () => {
  await new Promise((r) => mock.listen(0, '127.0.0.1', r));
  const hookUrl = `http://127.0.0.1:${mock.address().port}/webhook/${SECRET}`;
  await ready();
  const admin = (await api('POST', '/api/auth/admin/signup', { workspaceName: 'Acme', name: 'Ada Admin', email: 'ada@acme.test', password: 'correct-horse-battery' })).body;
  const eli = (await api('POST', '/api/auth/employee/signup', { inviteCode: admin.workspace.inviteCode, name: 'Eli Employee', email: 'eli@acme.test', password: 'another-good-password' })).body;
  const browser = await chromium.launch(); const problems = [];
  const mk = async (who, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'dark', permissions: ['clipboard-read', 'clipboard-write'], ...opts });
    await ctx.addInitScript((t) => localStorage.setItem('ol-token', t), who.token);
    const pg = await ctx.newPage();
    pg.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/status of (4|5)\d\d/.test(m.text())) problems.push(m.text()); });
    pg.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    return pg;
  };
  const p = await mk(admin);
  await p.goto(APP + '/admin/integrations', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  ok((await p.locator('h1').innerText()).includes('Integrations'), 'admin sees the Integrations page');
  ok((await p.locator('.chip', { hasText: 'Not set' }).count()) === 1, 'starts as "Not set"');
  ok(await p.getByRole('button', { name: 'Send test event' }).count() === 0, 'no "Send test event" before a URL exists');
  ok(await p.getByLabel('AI flow URL').isDisabled() && await p.getByLabel('M91 phone alerts').isDisabled(), 'AI-flow and M91 placeholders are disabled');
  ok(await p.locator('.log tbody tr').count() >= 9, 'JSON field reference lists the fields (' + await p.locator('.fields tbody tr').count() + ' rows)');
  ok(await p.locator('.empty').count() === 1, 'empty activity log shows the friendly empty state');

  // invalid URL is refused with a message
  await p.getByLabel('Events-flow URL').fill('ftp://example.com/hook'); await p.getByRole('button', { name: 'Save URL' }).click(); await p.waitForTimeout(600);
  ok(await p.locator('.field--error').count() === 1 && /https/.test(await p.locator('.field__msg--error').innerText()), 'a non-https URL is refused with a clear message');
  await p.screenshot({ path: `${SP}/shots/m4-integrations-empty.png`, fullPage: true });

  // save, masked
  await p.getByLabel('Events-flow URL').fill(hookUrl); await p.getByRole('button', { name: 'Save URL' }).click(); await p.waitForTimeout(900);
  ok(await p.locator('.chip--ok', { hasText: 'Connected' }).count() === 1, 'saving connects the flow');
  const html = await p.content();
  ok(!html.includes(SECRET) && !(await p.locator('body').innerText()).includes(SECRET), 'the secret part of the URL is nowhere on the page');
  ok(/••••••••/.test(await p.locator('.masked').innerText()) && await p.getByLabel('Events-flow URL').count() === 0, 'the saved URL is masked and the input is gone');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  ok(!(await p.content()).includes(SECRET) && await p.locator('.masked').count() === 1, 'still masked after a reload');

  // test event
  await p.getByRole('button', { name: 'Send test event' }).click(); await p.waitForTimeout(1200);
  ok(hits.length === 1 && hits[0].event === 'test.ping', 'the mock endpoint received a test.ping');
  ok(/Delivered \(HTTP 200\)/.test(await p.locator('.test-result').innerText()), 'the page reports "Delivered (HTTP 200)"');
  ok(await p.locator('.log tbody tr').first().innerText().then((t) => /test\.ping/.test(t) && /200/.test(t)), 'the log shows the attempt with its status code');

  // employee actions fire events
  const t1 = (await api('POST', '/api/tasks', outcome('Ship the pricing page'), eli.token)).body.task;
  await api('POST', `/api/tasks/${t1.id}/status`, { status: 'in_progress' }, eli.token);
  await wait(800);
  ok(hits.length === 3 && hits[1].event === 'task.created' && hits[2].event === 'task.status_changed', 'creating and moving an outcome POSTed task.created then task.status_changed');
  ok(Object.keys(hits[1]).join() === 'event,taskId,title,owner,status,impact,deadline,at,text' && /Eli Employee planned/.test(hits[1].text), 'payload is flat with the documented fields and a Slack text');

  // failures: 3 attempts, then gives up (real backoff ~18 s)
  status = 500;
  await api('POST', '/api/tasks', outcome('Close the five oldest tickets'), eli.token);
  await wait(21000);
  const failed = hits.slice(3);
  ok(failed.length === 3, 'a failing endpoint is tried exactly 3 times (got ' + failed.length + ')');
  await p.getByRole('button', { name: 'Refresh' }).click(); await p.waitForTimeout(600);
  const rows = await p.locator('.log tbody tr').allInnerTexts();
  ok(rows.filter((r) => /task\.created/.test(r) && /500/.test(r)).length === 3 && rows.some((r) => /gave up/.test(r)) && rows.some((r) => /will retry/.test(r)), 'the log shows 3 × 500, "will retry" then "gave up"');
  ok(!rows.join('').includes(SECRET) && !rows.join('').includes('127.0.0.1'), 'the log never shows the URL');
  await p.screenshot({ path: `${SP}/shots/m4-integrations-log.png`, fullPage: true });

  // copy buttons
  await p.getByRole('region', { name: 'JSON fields' }).scrollIntoViewIfNeeded();
  const copies = p.locator('.copyblock');
  await copies.nth(0).getByRole('button', { name: 'Copy' }).click(); await p.waitForTimeout(300);
  const clip1 = await p.evaluate(() => navigator.clipboard.readText());
  ok(clip1 === 'event\ttaskId\ttitle\towner\tstatus\timpact\tdeadline\tat\ttext', 'the Sheet header row copies tab-separated');
  await copies.nth(1).getByRole('button', { name: 'Copy' }).click(); await p.waitForTimeout(300);
  ok((await p.evaluate(() => navigator.clipboard.readText())) === '{{text}}', 'the Slack template copies');
  await copies.nth(2).getByRole('button', { name: 'Copy' }).click(); await p.waitForTimeout(300);
  ok(/\{\{owner\}\}/.test(await p.evaluate(() => navigator.clipboard.readText())), 'the detailed Slack template copies');

  // guard: employee cannot open it
  const e = await mk(eli); await e.goto(APP + '/admin/integrations', { waitUntil: 'networkidle' }); await e.waitForTimeout(1500);
  ok(new globalThis.URL(e.url()).pathname === '/app/dashboard', 'an employee is sent away from /admin/integrations');
  ok((await api('GET', '/api/integrations', null, eli.token)).status === 403, 'the API refuses the employee too (403)');

  // replace + remove
  await p.getByRole('button', { name: 'Replace URL' }).click(); ok(await p.getByLabel('Events-flow URL').count() === 1, 'Replace URL shows the input again');
  await p.getByRole('button', { name: 'Cancel' }).click();
  await p.getByRole('button', { name: 'Remove', exact: true }).click(); await p.getByRole('button', { name: 'Yes, remove it' }).click(); await p.waitForTimeout(800);
  ok(await p.locator('.chip', { hasText: 'Not set' }).count() === 1, 'Remove disconnects the flow');
  const before = hits.length; await api('POST', '/api/tasks', outcome('Publish the migration guide'), eli.token); await wait(800);
  ok(hits.length === before, 'no events are sent once the URL is removed');

  // light theme + mobile + reduced motion
  const l = await mk(admin, { colorScheme: 'light' }); await l.goto(APP + '/admin/integrations', { waitUntil: 'networkidle' }); await l.waitForTimeout(1200);
  await l.screenshot({ path: `${SP}/shots/m4-integrations-light.png`, fullPage: true });
  const m = await mk(admin, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await m.goto(APP + '/admin/integrations', { waitUntil: 'networkidle' }); await m.waitForTimeout(1300);
  ok(await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) === 0, 'mobile: no horizontal page overflow');
  await m.screenshot({ path: `${SP}/shots/m4-integrations-mobile.png`, fullPage: true });
  const r = await mk(admin, { reducedMotion: 'reduce' }); await r.goto(APP + '/admin/integrations', { waitUntil: 'networkidle' }); await r.waitForTimeout(600);
  ok((await r.locator('h1').innerText()).includes('Integrations'), 'reduced motion: page renders');

  await browser.close(); srv.kill('SIGTERM'); mock.close();
  console.log(problems.length ? 'CONSOLE PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'No console errors/warnings');
  if (problems.length) process.exitCode = 1;
})().catch((e) => { console.error('E2E CRASH', e); srv.kill('SIGTERM'); process.exit(2); });
