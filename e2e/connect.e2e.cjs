// Browser end-to-end test for the "Connect" cards (Google Sheets + Slack through viaSocket), milestone 4b.
// Needs Playwright + a built client:  npm run build && NODE_PATH=$(npm root -g) node e2e/connect.e2e.cjs
// The server runs in-process with a FAKE viaSocket (nothing leaves this machine) and the Connect popup script is stubbed
// in the browser, so this checks OUR screens and wiring, not viaSocket itself. The real popup is NOT tested here.
const { chromium } = require('playwright');
const fs = require('node:fs'); const path = require('node:path'); const os = require('node:os');
const ROOT = path.resolve(__dirname, '..');
const SP = process.env.SHOTS_DIR || path.join(os.tmpdir(), 'ol-e2e-shots');
fs.mkdirSync(path.join(SP, 'shots'), { recursive: true });
const DATA = '/tmp/ol-e2e-connect-data'; const PORT = 8093; const APP = `http://localhost:${PORT}`;
fs.rmSync(DATA, { recursive: true, force: true }); fs.mkdirSync(DATA, { recursive: true });
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) process.exitCode = 1; };

const AUTH = 'AUTH-E2E-SECRET-0001'; const SCRIPT = 'scrE2ESECRET0002';
const HEADER = ['event', 'taskId', 'title', 'owner', 'status', 'impact', 'deadline', 'at', 'text'];
const fake = { headerColumns: HEADER, runFails: null, runs: [], revoked: [], enabled: null };
const via = {
  configured: true, missing: [],
  embedToken: () => 'eyJhbGciOiJIUzI1NiJ9.eyJlMmUiOjF9.ZmFrZQ',
  listActions: async (u, slug) => ({ service_id: `svc-${slug}`, actions: [{ key: 'Add_New_Row_to_Sheet', action_id: 'act-sheet' }, { key: 'Send_Message', action_id: 'act-slack' }] }),
  listConnections: async () => [{ id: AUTH }],
  findEnabledApp: async () => fake.enabled,
  enableApp: async () => SCRIPT,
  revokeConnection: async (u, a) => { fake.revoked.push(a); },
  listOptions: async (u, slug, action, o) => {
    if (o.fieldKey === 'spreadsheet_Id') { const all = [{ label: 'Outcomes 2026', value: 'sheet-1' }, { label: 'Budget', value: 'sheet-2' }]; const q = (o.search || '').toLowerCase(); return { options: all.filter((x) => x.label.toLowerCase().includes(q)), paginate: null, hasMore: false, message: null }; }
    if (o.fieldKey === 'grid_Id') return { options: [{ label: 'Events', value: 'grid-1' }], paginate: null, hasMore: false, message: null };
    if (o.fieldKey === 'column_selected') return { options: fake.headerColumns.map((c, i) => ({ label: c, value: `col-${i}` })), paginate: null, hasMore: false, message: null };
    if (o.fieldKey === 'destination.channel_id') return o.paginate ? { options: [{ label: '#random', value: 'C999' }], paginate: null, hasMore: false, message: null } : { options: [{ label: '#outcomes', value: 'C123' }], paginate: 'p2', hasMore: true, message: null };
    return { options: [], paginate: null, hasMore: false, message: null };
  },
  runAction: async (scriptId, action, input) => { fake.runs.push({ scriptId, action, input }); if (fake.runFails) throw new Error(fake.runFails); return { success: true }; },
};

const api = async (m, p, b, t) => { const r = await fetch(APP + p, { method: m, headers: { 'content-type': 'application/json', ...(t ? { authorization: 'Bearer ' + t } : {}) }, body: b ? JSON.stringify(b) : undefined }); return { status: r.status, body: await r.json().catch(() => null) }; };
const outcome = (t) => ({ title: t, deadline: '2999-01-01', impact: 4, criteria: ['Live on production'], proofPlan: 'A link to the page' });

(async () => {
  const { loadConfig } = await import(path.join(ROOT, 'server/config.js'));
  const { createApp } = await import(path.join(ROOT, 'server/app.js'));
  const { JsonDb } = await import(path.join(ROOT, 'server/db.js'));
  const { Connect } = await import(path.join(ROOT, 'server/connect.js'));
  const { Outbox } = await import(path.join(ROOT, 'server/outbox.js'));
  const config = loadConfig({ NODE_ENV: 'development', JWT_SECRET: 'e2e-secret-'.repeat(4), DATA_DIR: DATA, PORT: String(PORT) });
  const db = JsonDb.open(config.dbFile);
  const connect = new Connect({ db, via });
  const app = createApp(config, { db, outbox: new Outbox({ db }), connect });
  const server = app.listen(PORT, '127.0.0.1'); await new Promise((r) => server.once('listening', r));

  const admin = (await api('POST', '/api/auth/admin/signup', { workspaceName: 'Acme', name: 'Ada Admin', email: 'ada@acme.test', password: 'correct-horse-battery' })).body;
  const eli = (await api('POST', '/api/auth/employee/signup', { inviteCode: admin.workspace.inviteCode, name: 'Eli Employee', email: 'eli@acme.test', password: 'another-good-password' })).body;

  const browser = await chromium.launch(); const problems = []; const external = [];
  const mk = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 1000 }, colorScheme: 'dark', permissions: ['clipboard-read', 'clipboard-write'], ...opts });
    await ctx.addInitScript((t) => localStorage.setItem('ol-token', t), admin.token);
    // The popup script is stubbed: calling it "connects" straight away, like a successful popup would (postMessage).
    await ctx.route('https://flow.viasocket.com/connect.js', (route) => route.fulfill({ contentType: 'text/javascript', body: `window.openViasocketConnection = function (token, serviceId, opts) { window.__connectCalls = (window.__connectCalls || []); window.__connectCalls.push({ tokenOk: /^eyJ/.test(token), serviceId, actions: opts.filteredActions, skip: opts.skipActionSelection }); setTimeout(function () { window.postMessage({ type: 'viasocket_connection_success', serviceId: serviceId, data: { id: '${AUTH}' } }, '*'); }, 50); };` }));
    const pg = await ctx.newPage();
    pg.on('request', (r) => { if (/viasocket|sokt\.io/.test(new URL(r.url()).host) && !r.url().endsWith('/connect.js')) external.push(r.url()); });
    pg.on('console', (m) => { if (['error', 'warning'].includes(m.type()) && !/status of (4|5)\d\d/.test(m.text())) problems.push(m.text()); });
    pg.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
    return pg;
  };

  const p = await mk();
  await p.goto(APP + '/admin/integrations', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  const sheets = p.locator('.connect-card[data-app=sheets]'); const slack = p.locator('.connect-card[data-app=slack]');
  ok(await sheets.count() === 1 && await slack.count() === 1, 'both Connect cards are on the Integrations page');
  ok((await sheets.innerText()).includes('Not connected') && (await slack.innerText()).includes('Not connected'), 'both start as "Not connected"');
  ok(await p.locator('.chip', { hasText: 'Not set' }).count() === 1 && await p.getByLabel('Events-flow URL').count() === 1, 'the Events URL card is still there and working');
  ok(await sheets.getByRole('button', { name: 'Connect Google Sheets' }).isEnabled() && await slack.getByRole('button', { name: 'Connect Slack' }).isEnabled(), 'Connect buttons are enabled once the token and script are ready');
  await p.screenshot({ path: `${SP}/shots/m4b-connect-start.png`, fullPage: true });

  // connect Sheets
  await sheets.getByRole('button', { name: 'Connect Google Sheets' }).click(); await p.waitForTimeout(1200);
  const calls = await p.evaluate(() => window.__connectCalls);
  ok(calls?.length === 1 && calls[0].tokenOk && calls[0].serviceId === 'svc-google-sheets' && calls[0].actions[0] === 'act-sheet' && calls[0].skip === true, 'the Connect popup is opened with the token, the service id and only the one action');
  ok((await sheets.innerText()).includes('Connected'), 'Sheets shows "Connected" after the popup reports success');
  ok(await sheets.getByRole('switch').isDisabled(), 'the on/off switch is disabled until a target is chosen');
  const ssOpts = await sheets.locator('#pick-spreadsheet option').allInnerTexts();
  ok(ssOpts.includes('Outcomes 2026') && ssOpts.includes('Budget'), 'the spreadsheet dropdown lists the spreadsheets');
  ok(await sheets.locator('#pick-worksheet').isDisabled(), 'the worksheet dropdown waits for a spreadsheet');
  await sheets.getByLabel('Search spreadsheet').fill('bud'); await p.waitForTimeout(900);
  ok((await sheets.locator('#pick-spreadsheet option').allInnerTexts()).filter((x) => /Outcomes|Budget/.test(x)).join() === 'Budget', 'typing in the search box filters the spreadsheet list');
  await sheets.getByLabel('Search spreadsheet').fill(''); await p.waitForTimeout(900);
  await sheets.locator('#pick-spreadsheet').selectOption({ label: 'Outcomes 2026' }); await p.waitForTimeout(700);
  ok(await sheets.locator('#pick-worksheet').isEnabled() && (await sheets.locator('#pick-worksheet option').allInnerTexts()).includes('Events'), 'choosing a spreadsheet enables the worksheet dropdown with its sheets');
  await sheets.locator('#pick-worksheet').selectOption({ label: 'Events' }); await p.waitForTimeout(900);
  ok((await sheets.innerText()).includes('Saved: Outcomes 2026') && (await sheets.innerText()).includes('Saved: Events'), 'the chosen spreadsheet and worksheet are saved and shown');
  ok(await sheets.getByRole('switch').isEnabled(), 'the switch is enabled once the target is complete');
  await sheets.getByRole('switch').click(); await p.waitForTimeout(700);
  ok(await sheets.getByRole('switch').getAttribute('aria-checked') === 'true' && (await sheets.innerText()).includes('On'), 'the switch turns Sheets ON');

  // connect Slack, with "show more" paging
  await slack.getByRole('button', { name: 'Connect Slack' }).click(); await p.waitForTimeout(1200);
  ok((await slack.innerText()).includes('Connected'), 'Slack shows "Connected"');
  await slack.getByRole('button', { name: 'Show more' }).click(); await p.waitForTimeout(700);
  ok((await slack.locator('#pick-channel option').allInnerTexts()).includes('#random'), '"Show more" appends the next page of channels');
  await slack.locator('#pick-channel').selectOption({ label: '#outcomes' }); await p.waitForTimeout(800);
  ok((await slack.innerText()).includes('Saved: #outcomes'), 'the chosen channel is saved and shown');
  await slack.getByRole('switch').click(); await p.waitForTimeout(600);
  ok(await slack.getByRole('switch').getAttribute('aria-checked') === 'true', 'Slack is switched ON');
  await p.screenshot({ path: `${SP}/shots/m4b-connect-on.png`, fullPage: true });

  // credentials never reach the page
  const page = (await p.content()) + (await p.locator('body').innerText());
  const apiSeen = JSON.stringify((await api('GET', '/api/integrations', null, admin.token)).body);
  ok(![AUTH, SCRIPT].some((s) => page.includes(s) || apiSeen.includes(s)), 'no auth id or script id is anywhere on the page or in the integrations API');
  ok(external.length === 0, 'the browser never called viaSocket (script stubbed; only our server talks to it)');

  // events: create + move
  const t1 = (await api('POST', '/api/tasks', outcome('Ship the pricing page'), eli.token)); await connect.idle();
  ok(t1.status === 201 && fake.runs.length === 2, 'creating an outcome runs one Sheets row and one Slack message');
  const row = fake.runs.find((r) => r.action === 'Add_New_Row_to_Sheet')?.input;
  ok(row && HEADER.every((h, i) => row.column_name[`col-${i}`] !== undefined) && row.column_name['col-2'] === 'Ship the pricing page', 'the row carries all nine columns, keyed by the sheet columns');
  await api('POST', `/api/tasks/${t1.body.task.id}/status`, { status: 'in_progress' }, eli.token); await connect.idle();
  ok(fake.runs.length === 4, 'moving a card runs a row and a message again');
  await p.getByRole('button', { name: 'Refresh' }).click(); await p.waitForTimeout(900);
  const logText = await p.locator('.log').first().innerText();
  ok(/Google Sheets/.test(logText) && /Slack/.test(logText) && /Delivered/.test(logText), 'the Activity log lists both with a "Via" column');

  // failure: still saved, in the log, no secret
  fake.runFails = `boom ${SCRIPT} ${AUTH} channel_not_found`;
  const t2 = await api('POST', '/api/tasks', outcome('Second outcome here'), eli.token); await connect.idle();
  ok(t2.status === 201 && (await api('GET', '/api/tasks', null, eli.token)).body.tasks.length === 2, 'when viaSocket fails the outcome is still saved');
  await p.getByRole('button', { name: 'Refresh' }).click(); await p.waitForTimeout(900);
  const failText = await p.locator('.log').first().innerText();
  ok(/viaSocket said no/.test(failText) && /channel_not_found/.test(failText), 'the failure appears in the Activity log with the reason');
  ok(!failText.includes(SCRIPT) && !failText.includes(AUTH) && !(await p.content()).includes(SCRIPT), 'the failure text carries no credential');
  fake.runFails = null;

  // switch off stops sends
  await sheets.getByRole('switch').click(); await p.waitForTimeout(600);
  ok(await sheets.getByRole('switch').getAttribute('aria-checked') === 'false', 'the switch turns Sheets OFF');
  const before = fake.runs.length;
  await api('POST', '/api/tasks', outcome('Third outcome here'), eli.token); await connect.idle();
  ok(fake.runs.length - before === 1 && fake.runs.at(-1).action === 'Send_Message', 'with Sheets off only Slack is sent');

  // test button asks first
  await slack.getByRole('button', { name: 'Send a test message' }).click(); await p.waitForTimeout(300);
  ok(await slack.getByRole('button', { name: 'Yes, post a test message' }).count() === 1 && /real message/.test(await slack.innerText()), 'the test button asks for confirmation and says it is real');
  const runsBeforeTest = fake.runs.length;
  await slack.getByRole('button', { name: 'No' }).click(); await p.waitForTimeout(200);
  ok(fake.runs.length === runsBeforeTest, 'answering No sends nothing');

  // disconnect asks first, then clears
  await sheets.getByRole('button', { name: 'Disconnect' }).click(); await p.waitForTimeout(300);
  ok(await sheets.getByRole('button', { name: 'Yes, disconnect' }).count() === 1, 'Disconnect asks first');
  await sheets.getByRole('button', { name: 'Yes, disconnect' }).click(); await p.waitForTimeout(900);
  ok((await sheets.innerText()).includes('Not connected') && fake.revoked.length === 1, 'Disconnect clears the card and revokes the connection');
  await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(900);
  const sT = await sheets.innerText(); const lT = await slack.innerText();
  ok(sT.includes('Not connected') && !lT.includes('Not connected') && lT.includes('Saved: #outcomes') && /\nOn\n/.test(lT), 'the state survives a reload (Sheets disconnected, Slack still on with its channel)');
  if (process.exitCode) console.log('   sheets:', JSON.stringify(sT.slice(0, 120)), ' slack:', JSON.stringify(lT.slice(0, 120)));

  // missing column titles
  fake.headerColumns = HEADER.filter((h) => !['owner', 'text'].includes(h));
  await sheets.getByRole('button', { name: 'Connect Google Sheets' }).click(); await p.waitForTimeout(1200);
  await sheets.locator('#pick-spreadsheet').selectOption({ label: 'Outcomes 2026' }); await p.waitForTimeout(700);
  await sheets.locator('#pick-worksheet').selectOption({ label: 'Events' }); await p.waitForTimeout(900);
  ok(await sheets.locator('.connect-warn').count() === 1 && /owner, text/.test(await sheets.locator('.connect-warn').innerText()), 'a worksheet missing column titles shows which ones, with a copy button');
  ok(await sheets.getByRole('switch').isDisabled(), 'the switch stays disabled while column titles are missing');
  await sheets.getByRole('button', { name: 'Copy header row' }).click(); await p.waitForTimeout(400);
  ok((await p.evaluate(() => navigator.clipboard.readText())) === HEADER.join('\t'), 'Copy header row puts the nine titles on the clipboard');
  fake.headerColumns = HEADER;

  // light theme, reduced motion, mobile
  const light = await mk({ colorScheme: 'light' }); await light.goto(APP + '/admin/integrations', { waitUntil: 'networkidle' }); await light.waitForTimeout(1200);
  await light.screenshot({ path: `${SP}/shots/m4b-connect-light.png`, fullPage: true });
  ok(await light.locator('.connect-card').count() === 2, 'light theme renders both cards');
  const rm = await mk({ reducedMotion: 'reduce' }); await rm.goto(APP + '/admin/integrations', { waitUntil: 'networkidle' }); await rm.waitForTimeout(800);
  ok(await rm.locator('.connect-card').count() === 2 && await rm.locator('.connect-card').first().isVisible(), 'reduced motion still shows the cards');
  const m = await mk({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }); await m.goto(APP + '/admin/integrations', { waitUntil: 'networkidle' }); await m.waitForTimeout(1200);
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no sideways scroll on a phone');
  await m.screenshot({ path: `${SP}/shots/m4b-connect-mobile.png`, fullPage: true });

  ok(problems.length === 0, 'no console errors or warnings' + (problems.length ? ': ' + problems.slice(0, 3).join(' | ') : ''));
  await browser.close(); server.close(); await db.flush(); process.exit(process.exitCode || 0);
})().catch((e) => { console.error('FAIL  crashed:', e); process.exit(1); });
