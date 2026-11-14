// Browser end-to-end test for auth, roles, guards, sessions and persistence (milestone 2).
//
// Needs Playwright + a built client:   npm run build && npx -y playwright install chromium
//                                      NODE_PATH=$(npm root -g) node e2e/auth.e2e.cjs     (or: npm i -D playwright)
// It boots its own server on :8090 with a throw-away DATA_DIR; screenshots go to $SHOTS_DIR (default: a temp folder).
const { chromium } = require('playwright');
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path');
const os = require('node:os');
const ROOT = path.resolve(__dirname, '..');
const SP = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'ol-e2e-shots');
fs.mkdirSync(path.join(SP, 'shots'), { recursive: true });
const DATA = '/tmp/ol-e2e-data'; const PORT = 8090; const URL = `http://localhost:${PORT}`;
fs.rmSync(DATA, { recursive: true, force: true });

function startServer() {
  const p = spawn('node', ['scripts/start.js'], { cwd: ROOT, env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'e2e-secret-'.repeat(4), DATA_DIR: DATA, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; p.stdout.on('data', d => log += d); p.stderr.on('data', d => log += d);
  return { p, log: () => log };
}
const wait = (ms) => new Promise(r => setTimeout(r, ms));
async function ready() { for (let i = 0; i < 40; i++) { try { const r = await fetch(URL + '/api/health'); if (r.ok) return; } catch {} await wait(250); } throw new Error('server not ready'); }
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) process.exitCode = 1; };

(async () => {
  let srv = startServer(); await ready();
  const browser = await chromium.launch();
  const problems = [];
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, colorScheme: 'dark', permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage();
  p.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/Failed to load resource: the server responded with a status of 4\d\d/.test(m.text())) problems.push(`console.${m.type()}: ${m.text()}`); });
  p.on('pageerror', e => problems.push('pageerror: ' + e.message));
  const settle = (ms = 1400) => p.waitForTimeout(ms);
  const mood = () => p.locator('.mascot').first().getAttribute('data-mood');

  // ── guards for anonymous visitors
  await p.goto(URL + '/app/dashboard', { waitUntil: 'networkidle' }); await settle(1800);
  ok(p.url().endsWith('/login'), 'anonymous /app/dashboard → /login');
  await p.goto(URL + '/admin/overview', { waitUntil: 'networkidle' }); await settle(1800);
  ok(p.url().endsWith('/login'), 'anonymous /admin/overview → /login');

  // ── admin sign-up: failure first
  await p.goto(URL + '/admin/signup', { waitUntil: 'networkidle' }); await settle(800);
  await p.getByLabel('Workspace name').fill('Acme Inc.'); await p.getByLabel('Your name').fill('Ada Admin');
  await p.getByLabel('Work email').fill('ada@acme.test'); await p.getByLabel('Password', { exact: true }).fill('short');
  await p.getByRole('button', { name: 'Create workspace' }).click(); await p.waitForTimeout(700);
  ok(await p.locator('.field--error').count() === 1, 'weak password → field error shown');
  ok((await p.locator('.form__error').textContent()).length > 5, 'form-level error banner shown');
  ok(await mood() === 'shrug', 'Tally shrugs on failure (mood=' + await mood() + ')');
  await p.screenshot({ path: `${SP}/shots/m2-admin-signup-error.png` });

  // ── admin sign-up: success
  await p.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await p.getByRole('button', { name: 'Create workspace' }).click(); await p.waitForTimeout(250);
  ok(await mood() === 'cheer', 'Tally cheers on success (mood=' + await mood() + ')');
  await p.waitForURL('**/admin/overview', { timeout: 8000 }); await settle(1800);
  const code = (await p.locator('.invite').textContent()).trim();
  ok(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code), 'admin lands on Overview with invite code ' + code);
  ok((await p.locator('.site-header').textContent()).includes('Ada'), 'header shows the signed-in name');
  ok(await p.evaluate(() => document.documentElement.dataset.ambient) === 'calm', 'admin area uses the calm ambient vibe');
  ok(await p.evaluate(() => document.documentElement.dataset.tone) === 'calm', 'admin area uses the calm tone');
  const tok = await p.evaluate(() => localStorage.getItem('ol-token')); ok(!!tok && tok.split('.').length === 3, 'JWT stored client-side');

  // copy buttons
  await p.getByRole('button', { name: 'Copy code' }).click(); await p.waitForTimeout(400);
  ok(await p.evaluate(() => navigator.clipboard.readText()) === code, 'Copy code puts the code on the clipboard');
  await p.getByRole('button', { name: 'Copy invite link' }).click(); await p.waitForTimeout(300);
  ok((await p.evaluate(() => navigator.clipboard.readText())).endsWith('/employee/signup?code=' + code), 'Copy invite link builds a prefilled URL');
  await p.screenshot({ path: `${SP}/shots/m2-admin-overview-empty.png` });

  // tab navigation inside the shell: no torn sheet, page still changes
  await p.getByRole('link', { name: 'Review Queue' }).click(); await p.waitForTimeout(90);
  ok(await p.locator('.torn').count() === 0, 'switching admin tabs does not rip the page');
  await settle(500); ok((await p.locator('h1').first().textContent()).includes('Review Queue'), 'tab navigation works');
  await p.getByRole('link', { name: 'Overview', exact: true }).click(); await settle(500);

  // sessions survive a reload
  await p.reload({ waitUntil: 'networkidle' }); await settle(1200);
  ok(p.url().endsWith('/admin/overview') && (await p.locator('.invite').count()) === 1, 'reload keeps the admin signed in');

  // ── log out
  await p.getByRole('button', { name: 'Log out' }).click(); await settle(1800);
  ok(await p.evaluate(() => localStorage.getItem('ol-token')) === null, 'logout clears the token');
  ok(p.url() === URL + '/' && (await p.locator('.site-header').textContent()).includes('Log in'), 'logout → landing with Log in button');

  // ── employee sign-up with a wrong, then right code
  await p.goto(URL + '/employee/signup', { waitUntil: 'networkidle' }); await settle(800);
  await p.getByLabel('Invite code').fill('abcdefgh'); await p.waitForTimeout(900);
  ok((await p.getByLabel('Invite code').inputValue()) === 'ABCD-EFGH', 'invite code auto-formats to ABCD-EFGH');
  ok((await p.locator('.field--error').textContent()).includes('No workspace'), 'unknown code is flagged live');
  await p.goto(URL + '/employee/signup?code=' + code, { waitUntil: 'networkidle' }); await settle(1200);
  ok((await p.locator('.field__msg--ok').textContent()).includes('Acme Inc.'), '?code= prefills and confirms "You\'re joining Acme Inc."');
  await p.getByLabel('Your name').fill('Eli Employee'); await p.getByLabel('Work email').fill('eli@acme.test'); await p.getByLabel('Password', { exact: true }).fill('another-good-password');
  await p.screenshot({ path: `${SP}/shots/m2-employee-signup.png` });
  await p.getByRole('button', { name: 'Join workspace' }).click();
  await p.waitForURL('**/app/dashboard', { timeout: 8000 }); await settle(1800);
  ok((await p.locator('h1').first().textContent()).includes('Eli'), 'employee lands on their Dashboard');
  ok(await p.evaluate(() => document.documentElement.dataset.tone) === 'playful', 'employee area keeps the playful tone');
  await p.screenshot({ path: `${SP}/shots/m2-employee-dashboard.png` });

  // ── role guards in the browser
  await p.goto(URL + '/admin/overview', { waitUntil: 'networkidle' }); await settle(2000);
  ok(p.url().endsWith('/app/dashboard'), 'employee opening /admin/overview is bounced to their dashboard');
  await p.goto(URL + '/login', { waitUntil: 'networkidle' }); await settle(2000);
  ok(p.url().endsWith('/app/dashboard'), 'signed-in user opening /login is sent home');
  const meStatus = await p.evaluate(async () => (await fetch('/api/team', { headers: { Authorization: 'Bearer ' + localStorage.getItem('ol-token') } })).status);
  ok(meStatus === 403, 'employee token gets 403 from /api/team');

  // ── admin sees the employee
  await p.getByRole('button', { name: 'Log out' }).click(); await settle(1500);
  await p.goto(URL + '/login', { waitUntil: 'networkidle' }); await settle(800);
  await p.getByLabel('Email').fill('ADA@acme.test'); await p.getByLabel('Password', { exact: true }).fill('wrong-password-here');
  await p.getByRole('button', { name: 'Log in', exact: true }).last().click(); await p.waitForTimeout(800);
  ok((await p.locator('.form__error').textContent()).includes('Wrong email or password'), 'wrong password → friendly error');
  await p.screenshot({ path: `${SP}/shots/m2-login-error.png` });
  await p.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await p.getByRole('button', { name: 'Log in', exact: true }).last().click();
  await p.waitForURL('**/admin/overview', { timeout: 8000 }); await settle(2200);
  ok((await p.locator('.members').textContent()).includes('Eli Employee'), 'admin sees the new employee in the team list');
  await p.screenshot({ path: `${SP}/shots/m2-admin-overview.png` });

  // regenerate flow
  await p.getByRole('button', { name: 'Regenerate' }).click(); await p.waitForTimeout(300);
  await p.getByRole('button', { name: 'Yes, retire the old code' }).click(); await p.waitForTimeout(900);
  const code2 = (await p.locator('.invite').textContent()).trim();
  ok(code2 !== code, 'regenerate shows a new invite code');
  const oldCheck = await p.evaluate(async (c) => (await (await fetch('/api/auth/invite/' + c)).json()).valid, code); ok(oldCheck === false, 'old invite code no longer valid');

  // ── db on disk: no plaintext, no tmp files
  const dbRaw = fs.readFileSync(path.join(DATA, 'db.json'), 'utf8');
  ok(!dbRaw.includes('correct-horse-battery') && !dbRaw.includes('another-good-password'), 'no plaintext passwords on disk');
  ok(/\$2[ab]\$10\$/.test(dbRaw), 'bcrypt hashes on disk');
  ok(fs.readdirSync(DATA).filter(f => f.includes('.tmp-')).length === 0, 'no temp files left in DATA_DIR');

  // ── restart persistence + graceful SIGTERM
  srv.p.kill('SIGTERM'); await new Promise(r => srv.p.once('exit', r));
  ok(srv.log().includes('SIGTERM received'), 'server shut down gracefully on SIGTERM');
  srv = startServer(); await ready();
  ok(srv.log().includes('2 users, 1 workspaces') || (await (async () => { await wait(300); return srv.log().includes('2 users'); })()), 'after restart the data is still there (2 users, 1 workspace)');
  await p.reload({ waitUntil: 'networkidle' }); await settle(1800);
  ok(p.url().endsWith('/admin/overview'), 'session survives a server restart');

  // ── mobile + light screenshots
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
  const m = await mctx.newPage(); m.on('console', x => { if (['error', 'warning'].includes(x.type())) problems.push('mobile console: ' + x.text()); });
  await m.goto(URL + '/login', { waitUntil: 'networkidle' }); await m.waitForTimeout(1800);
  await m.screenshot({ path: `${SP}/shots/m2-mobile-login.png` });
  ok(await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) === 0, 'mobile /login has no horizontal overflow');
  await m.getByLabel('Email').fill('ada@acme.test'); await m.getByLabel('Password', { exact: true }).fill('correct-horse-battery');
  await m.getByRole('button', { name: 'Log in', exact: true }).last().click(); await m.waitForURL('**/admin/overview', { timeout: 8000 }); await m.waitForTimeout(2200);
  await m.screenshot({ path: `${SP}/shots/m2-mobile-admin.png` });
  ok(await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) === 0, 'mobile admin overview has no horizontal overflow');
  const lctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, colorScheme: 'light' }); const l = await lctx.newPage();
  await l.goto(URL + '/admin/signup', { waitUntil: 'networkidle' }); await l.waitForTimeout(1500); await l.screenshot({ path: `${SP}/shots/m2-light-signup.png` });

  // reduced motion: guards + forms still work, no torn sheet
  const rctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, reducedMotion: 'reduce' }); const r = await rctx.newPage();
  await r.goto(URL + '/login', { waitUntil: 'networkidle' }); await r.getByLabel('Email').fill('eli@acme.test'); await r.getByLabel('Password', { exact: true }).fill('another-good-password');
  await r.getByRole('button', { name: 'Log in', exact: true }).last().click(); await r.waitForURL('**/app/dashboard', { timeout: 8000 });
  ok(await r.locator('.torn').count() === 0, 'reduced motion: login works with no torn sheet');

  await browser.close(); srv.p.kill('SIGTERM');
  console.log(problems.length ? 'CONSOLE PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'No console errors/warnings');
})().catch(e => { console.error('E2E CRASH', e); process.exit(2); });
