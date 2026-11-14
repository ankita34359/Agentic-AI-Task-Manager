// Browser end-to-end test for outcomes + the kanban board (milestone 3).
// Needs Playwright + a built client:  npm run build && NODE_PATH=$(npm root -g) node e2e/board.e2e.cjs
// Boots its own server on :8091 with a throw-away DATA_DIR; screenshots go to $SHOTS_DIR (default: a temp folder).
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const ROOT = path.resolve(__dirname, '..');
const SP = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'ol-e2e-shots');
fs.mkdirSync(path.join(SP, 'shots'), { recursive: true });
const DATA = '/tmp/ol-e2e-board-data'; const PORT = 8091; const URL = `http://localhost:${PORT}`;
fs.rmSync(DATA, { recursive: true, force: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) process.exitCode = 1; };

const srv = spawn('node', ['scripts/start.js'], { cwd: ROOT, env: { ...process.env, NODE_ENV: 'production', JWT_SECRET: 'e2e-secret-'.repeat(4), DATA_DIR: DATA, PORT: String(PORT) }, stdio: 'ignore' });
async function ready() { for (let i = 0; i < 40; i++) { try { if ((await fetch(URL + '/api/health')).ok) return; } catch {} await wait(250); } throw new Error('server not ready'); }
const api = async (method, p, body, token) => { const r = await fetch(URL + p, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };

(async () => {
  await ready();
  const admin = (await api('POST', '/api/auth/admin/signup', { workspaceName: 'Acme', name: 'Ada Admin', email: 'ada@acme.test', password: 'correct-horse-battery' })).body;
  const eli = (await api('POST', '/api/auth/employee/signup', { inviteCode: admin.workspace.inviteCode, name: 'Eli Employee', email: 'eli@acme.test', password: 'another-good-password' })).body;
  const browser = await chromium.launch();
  const problems = [];
  const mk = async (opts = {}, who = eli) => {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, colorScheme: 'dark', ...opts });
    await ctx.addInitScript((t) => localStorage.setItem('ol-token', t), who.token);
    const pg = await ctx.newPage();
    pg.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/status of 4\d\d/.test(m.text())) problems.push(`console.${m.type()}: ${m.text()}`); });
    pg.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    return pg;
  };
  const p = await mk();
  const col = (s) => p.locator(`.board-col[data-status="${s}"]`);
  const count = async (s) => col(s).locator('.board-card').count();

  await p.goto(URL + '/app/board', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  ok(await p.locator('.empty').count() === 1, 'empty board shows the friendly empty state');
  ok(await p.evaluate(() => document.documentElement.dataset.ambient) === 'calm', 'board uses the calm ambient vibe');
  ok((await p.locator('.board-col').count()) === 4, 'four columns: ' + (await p.locator('.board-col__title').allTextContents()).join(' | '));
  await p.screenshot({ path: `${SP}/shots/m3-board-empty.png` });

  // ── Outcome Coach flags vague wording, suggests criteria
  await p.getByRole('button', { name: 'Plan your first outcome' }).click();
  await p.getByLabel('Title').fill('Work on the report');
  await p.waitForSelector('.coach__flags', { timeout: 4000 });
  const flagText = await p.locator('.coach__flags').innerText();
  ok(/hard to prove/i.test(flagText), 'coach flags vague wording ("work on")');
  ok(await p.locator('.coach__chip').count() >= 2, 'coach suggests acceptance criteria');
  await p.locator('.coach__chip').first().click();
  ok((await p.getByLabel('Criterion 1', { exact: true }).inputValue()).length > 10, 'clicking a suggestion fills the criterion');
  await p.screenshot({ path: `${SP}/shots/m3-form-coach.png` });

  // ── server-side field errors are shown inline (bad impact path is covered by unit tests; here: empty proof plan)
  await p.getByRole('button', { name: 'Add to Planned' }).click(); await p.waitForTimeout(500);
  ok(await p.locator('.field--error').count() >= 1, 'submitting without a proof plan shows an inline error');

  // ── create three outcomes through the UI
  const fill = async (title) => {
    await p.getByLabel('Title').fill(title);
    await p.getByLabel('Criterion 1', { exact: true }).fill('The result is live and a reviewer confirmed it');
    await p.getByLabel('How I will prove it').fill('A link to the live result and a screenshot');
    await p.getByLabel('Deadline').fill('2999-01-01');
    await p.getByRole('radio', { name: '4' }).click();
    await p.getByRole('button', { name: 'Add to Planned' }).click();
  };
  await fill('Ship the Q3 pricing page to 100% of visitors'); await p.waitForTimeout(700);
  ok(await count('planned') === 1, 'first outcome lands in Planned');
  for (const t of ['Close the 5 oldest support tickets this week', 'Publish the migration guide to the docs site']) {
    await p.getByRole('button', { name: 'New outcome' }).click(); await p.getByLabel('Criterion 1', { exact: true }).waitFor();
    await p.getByLabel('Title').fill(t);
    await p.getByLabel('Criterion 1', { exact: true }).fill('Published and linked from the homepage');
    await p.getByLabel('How I will prove it').fill('Link to the published page');
    await p.getByRole('button', { name: 'Add to Planned' }).click(); await p.waitForTimeout(700);
  }
  ok(await count('planned') === 3, 'three outcomes in Planned');
  ok((await p.locator('.pips__text').innerText()).startsWith('3/3'), 'pips show 3/3 used');
  ok(await p.getByRole('button', { name: 'New outcome' }).isDisabled(), 'New outcome is disabled at the daily limit');
  ok(await p.locator('.limit-note').count() === 1, 'a witty limit line explains why');
  const fourth = await api('POST', '/api/tasks', { title: 'A fourth outcome today', deadline: '2999-01-01', impact: 3, criteria: ['Something checkable'], proofPlan: 'a link' }, eli.token);
  ok(fourth.status === 409 && fourth.body.error === 'daily_limit', 'the server refuses the 4th outcome (409 daily_limit)');
  await p.screenshot({ path: `${SP}/shots/m3-board-three.png`, fullPage: true });

  // ── drag Planned → In Progress with the mouse
  const drag = async (title, to) => {
    const card = p.locator('.board-card', { hasText: title }).first();
    const from = await card.locator('.board-note__title').boundingBox();
    const target = await col(to).boundingBox();
    await p.mouse.move(from.x + 20, from.y + 8); await p.mouse.down();
    await p.mouse.move(from.x + 40, from.y + 30, { steps: 4 });
    await p.mouse.move(target.x + target.width / 2, target.y + 140, { steps: 14 });
    await p.waitForTimeout(150);
    return { up: async () => { await p.mouse.up(); await p.waitForTimeout(600); } };
  };
  let d = await drag('pricing page', 'in_progress');
  ok(await p.locator('.board-overlay').count() === 1, 'a floating squashed note follows the pointer while dragging');
  ok(await col('in_progress').evaluate((n) => n.classList.contains('board-col--over')), 'the target column highlights');
  await p.screenshot({ path: `${SP}/shots/m3-dragging.png` });
  await d.up();
  ok(await count('in_progress') === 1 && await count('planned') === 2, 'dropping on In Progress moves the note');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1000);
  ok(await count('in_progress') === 1, 'the move persisted (server) after reload');

  // ── Move to… menu (the mobile/keyboard path)
  await p.locator('.board-card', { hasText: 'pricing page' }).locator('select').selectOption('planned'); await p.waitForTimeout(600);
  ok(await count('planned') === 3 && await count('in_progress') === 0, '"Move to…" moves a note back to Planned');
  await p.locator('.board-card', { hasText: 'pricing page' }).locator('select').selectOption('in_progress'); await p.waitForTimeout(600);

  // ── Done / In Review are refused for the employee; Done opens the proof dialog
  d = await drag('pricing page', 'done'); await d.up();
  ok(await p.getByRole('dialog').count() === 1, 'dropping on Done opens the proof dialog');
  ok(await count('done') === 0 && await count('in_progress') === 1, 'the note did NOT move to Done');
  await p.screenshot({ path: `${SP}/shots/m3-proof-dialog.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  ok(await p.getByRole('dialog').count() === 0, 'Esc closes the dialog');
  await p.locator('.board-card', { hasText: 'migration guide' }).locator('select').selectOption('done'); await p.waitForTimeout(500);
  ok(await p.locator('.toast-warn').count() >= 1 && await count('done') === 0, 'a Planned note cannot jump to Done (toast, no move)');
  const direct = await api('POST', `/api/tasks/${(await api('GET', '/api/tasks', null, eli.token)).body.tasks[0].id}/status`, { status: 'done' }, eli.token);
  ok(direct.status === 409 && direct.body.error === 'verified_only', 'the API refuses Done directly (409 verified_only)');

  // ── keyboard: focus, Space, →, Space
  const guide = p.locator('.board-card', { hasText: 'migration guide' }).first();
  await guide.focus(); await p.keyboard.press('Space'); await p.waitForTimeout(250);
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(250);
  await p.keyboard.press('Space'); await p.waitForTimeout(700);
  ok(await count('in_progress') === 2, 'keyboard: Space, →, Space moves a note to In Progress');

  // ── guards: admin has no board
  const a = await mk({}, admin); await a.goto(URL + '/app/board', { waitUntil: 'networkidle' }); await a.waitForTimeout(1500);
  ok(new globalThis.URL(a.url()).pathname === '/admin/overview', 'an admin visiting /app/board is sent to the admin overview');

  // ── light theme + reduced motion + mobile
  const l = await mk({ colorScheme: 'light' }); await l.goto(URL + '/app/board', { waitUntil: 'networkidle' }); await l.waitForTimeout(1500);
  await l.screenshot({ path: `${SP}/shots/m3-board-light.png`, fullPage: true });
  const r = await mk({ reducedMotion: 'reduce' }); await r.goto(URL + '/app/board', { waitUntil: 'networkidle' }); await r.waitForTimeout(800);
  ok(await r.locator('.board-card').count() === 3, 'reduced motion: the board renders and works');
  const m = await mk({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light' });
  await m.goto(URL + '/app/board', { waitUntil: 'networkidle' }); await m.waitForTimeout(1500);
  ok(await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) === 0, 'mobile board has no horizontal page overflow');
  ok(await m.evaluate(() => { const b = document.querySelector('.board'); return b.scrollWidth > b.clientWidth; }), 'mobile columns swipe sideways inside the board');
  await m.screenshot({ path: `${SP}/shots/m3-board-mobile.png` });
  const sel = m.locator('.board-card', { hasText: 'support tickets' }).locator('select');
  const box = await sel.boundingBox();
  ok(box.height >= 44, 'mobile "Move to…" target is at least 44px tall (' + Math.round(box.height) + 'px)');
  await sel.selectOption('in_progress'); await m.waitForTimeout(700);
  ok(await m.locator('.board-col[data-status="in_progress"] .board-card').count() === 3, 'mobile: "Move to…" works');
  await m.getByRole('button', { name: 'Close form' }).count();

  await browser.close(); srv.kill('SIGTERM');
  console.log(problems.length ? 'CONSOLE PROBLEMS:\n' + [...new Set(problems)].join('\n') : 'No console errors/warnings');
  if (problems.length) process.exitCode = 1;
})().catch((e) => { console.error('E2E CRASH', e); srv.kill('SIGTERM'); process.exit(2); });
