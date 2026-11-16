import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startApp, adminBody, employeeBody } from './test-helpers.js';
import { createViaSocket, APPS, isScriptId } from './lib/viasocket.js';
import { SHEET_HEADER } from './lib/events.js';
import { scrub } from './connect.js';

// Planted credentials: they must never show up in any response, the data the browser sees, the activity log or an error.
const AUTH = 'AUTHSECRET_1234567890_rowqm5xi2';
const SCRIPT = 'scrSECRET987654';
const EMBED_SECRET = 'embed-secret-that-must-never-leak-0000';
const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJ1bmlxdWUiOiJ4In0.c2lnbmF0dXJlLXNlY3JldA';

/** A scripted stand-in for viaSocket: records every call, answers from `state`. */
function fakeVia(state = {}) {
  const s = { connections: [{ id: AUTH }], enabled: null, headerColumns: SHEET_HEADER, runFails: null, calls: [], revoked: [], ...state };
  const log = (name, ...args) => s.calls.push({ name, args });
  const via = {
    configured: true,
    missing: [],
    embedToken: (u) => (log('embedToken', u), FAKE_JWT),
    listActions: async (u, slug) => (log('listActions', slug), { service_id: `svc-${slug}`, actions: [{ key: 'Add_New_Row_to_Sheet', action_id: 'act-sheet' }, { key: 'Send_Message', action_id: 'act-slack' }] }),
    listConnections: async (u) => (log('listConnections', u), s.connections),
    findEnabledApp: async () => s.enabled,
    enableApp: async (u, slug, authId) => (log('enableApp', slug, authId), SCRIPT),
    revokeConnection: async (u, authId) => {
      log('revoke', authId);
      s.revoked.push(authId);
    },
    listOptions: async (u, slug, action, o) => {
      log('listOptions', slug, action, o);
      if (o.fieldKey === 'spreadsheet_Id') return { options: [{ label: 'Outcomes 2026', value: 'sheet-1' }], paginate: null, hasMore: false, message: null };
      if (o.fieldKey === 'grid_Id') return { options: [{ label: 'Events', value: 'grid-1' }], paginate: null, hasMore: false, message: null };
      if (o.fieldKey === 'column_selected') return { options: s.headerColumns.map((c, i) => ({ label: c, value: `col-${i}` })), paginate: null, hasMore: false, message: null };
      if (o.fieldKey === 'destination.channel_id') return { options: [{ label: '#outcomes', value: 'C123' }], paginate: 'next-1', hasMore: true, message: null };
      return { options: [], paginate: null, hasMore: false, message: null };
    },
    runAction: async (scriptId, action, inputData, o) => {
      log('runAction', scriptId, action, inputData, o);
      if (s.runFails?.[action]) throw new Error(s.runFails[action]);
      return { success: true };
    },
  };
  return { via, s, runs: () => s.calls.filter((c) => c.name === 'runAction') };
}

async function world(viaState) {
  const f = fakeVia(viaState);
  const t = await startApp({ via: f.via });
  const admin = (await t.post('/api/auth/admin/signup', adminBody())).body;
  const eli = (await t.post('/api/auth/employee/signup', employeeBody(admin.workspace.inviteCode))).body;
  const A = (m, u, body) => t.call(m, `/api/integrations/viasocket${u}`, { token: admin.token, body });
  const outcome = (over = {}) => t.post('/api/tasks', { title: 'Ship the pricing page', deadline: '2999-01-01', impact: 4, criteria: ['Live on production'], proofPlan: 'Link to the page', ...over }, { token: eli.token });
  // Connect both apps, pick targets, switch both on.
  async function setupAll() {
    assert.equal((await A('POST', '/sheets/connected', { authId: AUTH })).status, 200);
    assert.equal((await A('POST', '/slack/connected', { authId: AUTH })).status, 200);
    assert.equal((await A('PUT', '/sheets/target', { spreadsheetId: 'sheet-1', spreadsheetName: 'Outcomes 2026', gridId: 'grid-1', gridName: 'Events' })).status, 200);
    assert.equal((await A('PUT', '/slack/target', { channelId: 'C123', channelName: '#outcomes' })).status, 200);
    assert.equal((await A('PUT', '/sheets/enabled', { enabled: true })).status, 200);
    assert.equal((await A('PUT', '/slack/enabled', { enabled: true })).status, 200);
  }
  return { t, f, admin, eli, A, outcome, setupAll };
}

const noSecrets = (value, label = '') => {
  const text = JSON.stringify(value);
  for (const secret of [AUTH, SCRIPT, EMBED_SECRET]) assert.equal(text.includes(secret), false, `${label} leaked a credential`);
};

// ───────── the viaSocket client ─────────
test('embed token: HS256 with org_id, project_id and unique_identifier; the API gets the bare token', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => (seen.push({ url, init }), new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }));
  const via = createViaSocket({ orgId: 'o1', projectId: 'p1', embedSecret: EMBED_SECRET }, { fetchImpl });
  const token = via.embedToken('ol-ws-1');
  const claims = jwt.verify(token, EMBED_SECRET, { algorithms: ['HS256'] });
  assert.deepEqual([claims.org_id, claims.project_id, claims.unique_identifier], ['o1', 'p1', 'ol-ws-1']);
  await via.listConnections('ol-ws-1');
  assert.equal(seen[0].url, 'https://flow-api.viasocket.com/embed/authentications');
  assert.match(seen[0].init.headers.authorization, /^eyJ/);
  assert.equal(/^Bearer/i.test(seen[0].init.headers.authorization), false);
});

test('not configured: every call says which variable names are missing, never a value', () => {
  const via = createViaSocket({ orgId: 'o1', projectId: '', embedSecret: '' });
  assert.equal(via.configured, false);
  assert.deepEqual(via.missing, ['VIASOCKET_PROJECT_ID', 'VIASOCKET_EMBED_SECRET']);
  assert.throws(() => via.embedToken('u'), /not set up/);
});

test('runAction: runs on flow.sokt.io with the pinned version, unwraps data, and turns failures into short errors', async () => {
  const seen = [];
  let reply = { status: 200, body: { success: true, data: { ok: 1 } } };
  const fetchImpl = async (url, init) => (seen.push({ url, init }), new Response(JSON.stringify(reply.body), { status: reply.status }));
  const via = createViaSocket({ orgId: 'o', projectId: 'p', embedSecret: 's' }, { fetchImpl });
  assert.deepEqual(await via.runAction(SCRIPT, 'Send_Message', { a: 1 }, { version: 'v107' }), { ok: 1 });
  assert.equal(seen[0].url, `https://flow.sokt.io/func/${SCRIPT}`);
  assert.deepEqual(JSON.parse(seen[0].init.body), { action: 'Send_Message', version: 'v107', inputData: { a: 1 } });
  assert.equal(seen[0].init.headers.authorization, undefined, 'no token: the script_id is the credential');
  reply = { status: 400, body: { success: false, errorMsg: { status: 400, message: 'channel_not_found' } } };
  await assert.rejects(() => via.runAction(SCRIPT, 'Send_Message', {}), (e) => /channel_not_found/.test(e.message) && !e.message.includes(SCRIPT));
  await assert.rejects(() => via.runAction('../../etc/passwd', 'x', {}), /Bad flow id/);
  assert.equal(isScriptId('a/b'), false);
});

test('a network failure message never contains the URL (it can hold a script_id)', async () => {
  const fetchImpl = async () => {
    throw Object.assign(new Error(`connect ECONNREFUSED https://flow.sokt.io/func/${SCRIPT}`), { code: 'ECONNREFUSED' });
  };
  const via = createViaSocket({ orgId: 'o', projectId: 'p', embedSecret: 's' }, { fetchImpl });
  await assert.rejects(() => via.runAction(SCRIPT, 'x', {}), (e) => !e.message.includes(SCRIPT) && /ECONNREFUSED/.test(e.message));
});

test('scrub removes known ids, JWTs and run URLs', () => {
  const out = scrub(`failed ${AUTH} ${SCRIPT} ${FAKE_JWT} https://flow.sokt.io/func/abcDEF123`, [AUTH, SCRIPT]);
  for (const bad of [AUTH, SCRIPT, FAKE_JWT, 'abcDEF123']) assert.equal(out.includes(bad), false, bad);
});

// ───────── routes ─────────
test('not configured: the page can still load; token and connect answer 503 naming only the variable names', async () => {
  const t = await startApp(); // real client, no env
  try {
    const admin = (await t.post('/api/auth/admin/signup', adminBody())).body;
    const page = await t.get('/api/integrations', { token: admin.token });
    assert.equal(page.status, 200);
    assert.equal(page.body.connect.configured, false);
    assert.deepEqual(page.body.connect.missing, ['VIASOCKET_ORG_ID', 'VIASOCKET_PROJECT_ID', 'VIASOCKET_EMBED_SECRET']);
    const tok = await t.get('/api/integrations/viasocket/token', { token: admin.token });
    assert.equal(tok.status, 503);
    assert.equal(tok.body.error, 'viasocket_not_configured');
  } finally {
    await t.close();
  }
});

test('Connect routes are admin only and need a login', async () => {
  const w = await world();
  try {
    for (const [m, u] of [['GET', '/token'], ['POST', '/sheets/connected'], ['GET', '/sheets/options?field=spreadsheet'], ['PUT', '/sheets/target'], ['PUT', '/sheets/enabled'], ['POST', '/sheets/test'], ['DELETE', '/sheets']]) {
      assert.equal((await w.t.call(m, `/api/integrations/viasocket${u}`, m === 'GET' ? {} : { body: {} })).status, 401, `${m} ${u} anonymous`);
      assert.equal((await w.t.call(m, `/api/integrations/viasocket${u}`, { token: w.eli.token, ...(m === 'GET' ? {} : { body: {} }) })).status, 403, `${m} ${u} employee`);
    }
  } finally {
    await w.t.close();
  }
});

test('token endpoint: the embed token, service ids and action ids for the popup; nothing else', async () => {
  const w = await world();
  try {
    const r = await w.A('GET', '/token');
    assert.equal(r.status, 200);
    assert.equal(r.body.token, FAKE_JWT);
    assert.deepEqual(r.body.apps.sheets, { slug: 'google-sheets', serviceId: 'svc-google-sheets', actionId: 'act-sheet' });
    assert.deepEqual(r.body.apps.slack, { slug: 'slack', serviceId: 'svc-slack', actionId: 'act-slack' });
    assert.equal(w.f.s.calls.find((c) => c.name === 'embedToken').args[0], `ol-ws-${w.admin.workspace.id}`, 'one viaSocket user per workspace');
  } finally {
    await w.t.close();
  }
});

test('connected: the browser only names an auth id; the server checks viaSocket lists it, enables the app and keeps the ids to itself', async () => {
  const w = await world();
  try {
    const forged = await w.A('POST', '/sheets/connected', { authId: 'someone-elses-connection-id' });
    assert.equal(forged.status, 409);
    assert.equal(forged.body.error, 'unknown_connection');
    assert.equal((await w.A('POST', '/sheets/connected', { authId: 'x' })).status, 400);
    assert.equal((await w.A('POST', '/nope/connected', { authId: AUTH })).status, 404);
    const ok = await w.A('POST', '/sheets/connected', { authId: AUTH });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.connect.sheets.connected, true);
    assert.equal(ok.body.connect.sheets.ready, false);
    noSecrets(ok.body, 'connected response');
    noSecrets((await w.t.get('/api/integrations', { token: w.admin.token })).body, 'integrations page');
    const stored = w.t.db.data.workspaces[0].integrations.connect.sheets;
    assert.equal(stored.authId, AUTH);
    assert.equal(stored.scriptId, SCRIPT);
  } finally {
    await w.t.close();
  }
});

test('pickers: dropdown lists come from viaSocket with the pinned action, per field', async () => {
  const w = await world();
  try {
    assert.equal((await w.A('GET', '/sheets/options?field=spreadsheet')).status, 409, 'not connected yet');
    await w.A('POST', '/sheets/connected', { authId: AUTH });
    await w.A('POST', '/slack/connected', { authId: AUTH });
    const sp = await w.A('GET', '/sheets/options?field=spreadsheet&search=out');
    assert.deepEqual(sp.body.options, [{ label: 'Outcomes 2026', value: 'sheet-1' }]);
    const call = w.f.s.calls.filter((c) => c.name === 'listOptions').at(-1);
    assert.deepEqual([call.args[0], call.args[1], call.args[2].fieldKey, call.args[2].version, call.args[2].search], ['google-sheets', 'Add_New_Row_to_Sheet', 'spreadsheet_Id', 'v66', 'out']);
    assert.equal((await w.A('GET', '/sheets/options?field=sheet')).status, 400, 'a worksheet list needs a spreadsheet first');
    const gr = await w.A('GET', '/sheets/options?field=sheet&spreadsheetId=sheet-1');
    assert.deepEqual(gr.body.options, [{ label: 'Events', value: 'grid-1' }]);
    assert.deepEqual(w.f.s.calls.filter((c) => c.name === 'listOptions').at(-1).args[2].existingFields, { spreadsheet_Id: 'sheet-1' });
    const ch = await w.A('GET', '/slack/options?field=channel');
    assert.equal(ch.body.hasMore, true);
    assert.equal(ch.body.paginate, 'next-1');
    assert.equal(w.f.s.calls.filter((c) => c.name === 'listOptions').at(-1).args[2].fieldKey, 'destination.channel_id');
    assert.equal((await w.A('GET', '/slack/options?field=spreadsheet')).status, 400, 'a Slack card cannot list spreadsheets');
    noSecrets([sp.body, gr.body, ch.body], 'options');
  } finally {
    await w.t.close();
  }
});

test('Sheets target: row 1 must carry all nine column titles; missing ones are named and block the toggle', async () => {
  const w = await world({ headerColumns: SHEET_HEADER.filter((c) => c !== 'owner' && c !== 'text') });
  try {
    await w.A('POST', '/sheets/connected', { authId: AUTH });
    const pick = await w.A('PUT', '/sheets/target', { spreadsheetId: 'sheet-1', spreadsheetName: 'S', gridId: 'grid-1', gridName: 'G' });
    assert.equal(pick.status, 200);
    assert.deepEqual(pick.body.connect.sheets.missingColumns, ['owner', 'text']);
    assert.equal(pick.body.connect.sheets.ready, false);
    const on = await w.A('PUT', '/sheets/enabled', { enabled: true });
    assert.equal(on.status, 409);
    assert.equal(on.body.error, 'not_ready');
  } finally {
    await w.t.close();
  }
});

test('creating an outcome adds a row (columns mapped by title) and posts the Slack line', async () => {
  const w = await world();
  try {
    await w.setupAll();
    const r = await w.outcome();
    assert.equal(r.status, 201);
    await w.t.connect.idle();
    const runs = w.f.runs();
    assert.equal(runs.length, 2);
    const sheet = runs.find((c) => c.args[1] === 'Add_New_Row_to_Sheet');
    const slack = runs.find((c) => c.args[1] === 'Send_Message');
    assert.equal(sheet.args[0], SCRIPT);
    assert.equal(sheet.args[3].version, 'v66');
    const input = sheet.args[2];
    assert.deepEqual([input.spreadsheet_Id, input.grid_Id, input.column_key], ['sheet-1', 'grid-1', true]);
    assert.deepEqual(input.column_selected, SHEET_HEADER.map((_, i) => `col-${i}`));
    assert.equal(input.column_name['col-0'], 'task.created'); // event
    assert.equal(input.column_name['col-2'], 'Ship the pricing page'); // title
    assert.equal(input.column_name['col-3'], 'Eli Employee'); // owner
    assert.equal(input.column_name['col-4'], 'planned'); // status
    assert.equal(input.column_name['col-5'], '4'); // impact, as text
    assert.match(input.column_name['col-8'], /planned “Ship the pricing page”/); // text
    assert.equal(slack.args[3].version, 'v107');
    assert.deepEqual(slack.args[2].destination, { messageto: 'channel', channel_id: ['C123'] });
    assert.match(slack.args[2].markdown_content, /Eli Employee planned “Ship the pricing page”/);
    const log = (await w.t.get('/api/integrations', { token: w.admin.token })).body.activity;
    assert.deepEqual(log.filter((a) => a.ok).map((a) => a.via).sort(), ['sheets', 'slack']);
  } finally {
    await w.t.close();
  }
});

test('moving a card adds a row and posts a message', async () => {
  const w = await world();
  try {
    await w.setupAll();
    const id = (await w.outcome()).body.task.id;
    await w.t.connect.idle();
    const before = w.f.runs().length;
    assert.equal((await w.t.post(`/api/tasks/${id}/status`, { status: 'in_progress' }, { token: w.eli.token })).status, 200);
    await w.t.connect.idle();
    const runs = w.f.runs().slice(before);
    assert.equal(runs.length, 2);
    assert.equal(runs.find((c) => c.args[1] === 'Add_New_Row_to_Sheet').args[2].column_name['col-0'], 'task.status_changed');
    assert.match(runs.find((c) => c.args[1] === 'Send_Message').args[2].markdown_content, /Planned → In Progress/);
  } finally {
    await w.t.close();
  }
});

test('if viaSocket fails the outcome is still saved, and the failure is in the Activity log without any credential', async () => {
  const w = await world({ runFails: { Add_New_Row_to_Sheet: `boom ${SCRIPT} ${AUTH} ${FAKE_JWT} https://flow.sokt.io/func/${SCRIPT}`, Send_Message: 'channel_not_found' } });
  try {
    await w.setupAll();
    const r = await w.outcome();
    assert.equal(r.status, 201, 'the save must not depend on viaSocket');
    await w.t.connect.idle();
    assert.equal((await w.t.get('/api/tasks', { token: w.eli.token })).body.tasks.length, 1);
    assert.equal(w.t.db.data.tasks.length, 1);
    const page = (await w.t.get('/api/integrations', { token: w.admin.token })).body;
    const failed = page.activity.filter((a) => !a.ok);
    assert.deepEqual(failed.map((a) => a.via).sort(), ['sheets', 'slack']);
    assert.ok(failed.every((a) => a.error === 'viasocket' && a.detail));
    assert.match(failed.find((a) => a.via === 'slack').detail, /channel_not_found/);
    noSecrets(page, 'activity log');
    assert.equal(JSON.stringify(page).includes(FAKE_JWT), false);
    // the status move is also unaffected
    const id = r.body.task.id;
    assert.equal((await w.t.post(`/api/tasks/${id}/status`, { status: 'in_progress' }, { token: w.eli.token })).status, 200);
    await w.t.connect.idle();
  } finally {
    await w.t.close();
  }
});

test('a hung viaSocket call does not delay the employee: the response comes before the integration finishes', async () => {
  let release;
  const gate = new Promise((r) => (release = r));
  const w = await world();
  w.f.via.runAction = async () => {
    await gate;
    return { success: true };
  };
  try {
    await w.setupAll();
    const r = await w.outcome(); // would hang forever if the route awaited the integration
    assert.equal(r.status, 201);
    assert.equal(w.t.connect.pending.size > 0, true);
    release();
    await w.t.connect.idle();
  } finally {
    release();
    await w.t.close();
  }
});

test('off means off: toggling an app off stops its sends; the other one keeps going', async () => {
  const w = await world();
  try {
    await w.setupAll();
    assert.equal((await w.A('PUT', '/sheets/enabled', { enabled: false })).body.connect.sheets.enabled, false);
    await w.outcome();
    await w.t.connect.idle();
    assert.deepEqual(w.f.runs().map((c) => c.args[1]), ['Send_Message']);
    assert.equal((await w.A('PUT', '/slack/enabled', { enabled: false })).status, 200);
    await w.outcome({ title: 'Second outcome here' });
    await w.t.connect.idle();
    assert.equal(w.f.runs().length, 1);
  } finally {
    await w.t.close();
  }
});

test('disconnect revokes the connection at viaSocket, clears our copy of the ids, and stops sending', async () => {
  const w = await world();
  try {
    await w.setupAll();
    const r = await w.A('DELETE', '/sheets');
    assert.equal(r.status, 200);
    assert.equal(r.body.connect.sheets.connected, false);
    assert.deepEqual(w.f.s.revoked, [AUTH]);
    assert.equal(w.t.db.data.workspaces[0].integrations.connect.sheets, undefined);
    await w.outcome();
    await w.t.connect.idle();
    assert.deepEqual(w.f.runs().map((c) => c.args[1]), ['Send_Message']);
    noSecrets(r.body, 'disconnect');
  } finally {
    await w.t.close();
  }
});

test('the test button sends one real row / message, only to the app asked for', async () => {
  const w = await world();
  try {
    await w.setupAll();
    const r = await w.A('POST', '/slack/test');
    assert.equal(r.status, 200);
    assert.equal(r.body.result.ok, true);
    assert.deepEqual(w.f.runs().map((c) => c.args[1]), ['Send_Message']);
    assert.match(w.f.runs()[0].args[2].markdown_content, /Test event from Outcome Ledger/);
    const notReady = await world();
    try {
      await notReady.A('POST', '/sheets/connected', { authId: AUTH });
      assert.equal((await notReady.A('POST', '/sheets/test')).status, 409);
    } finally {
      await notReady.t.close();
    }
  } finally {
    await w.t.close();
  }
});

test('workspaces are isolated: another workspace never sees or uses this one’s connection', async () => {
  const w = await world();
  try {
    await w.setupAll();
    const other = (await w.t.post('/api/auth/admin/signup', adminBody({ workspaceName: 'Other Co' }))).body;
    const page = (await w.t.get('/api/integrations', { token: other.token })).body;
    assert.equal(page.connect.sheets.connected, false);
    assert.equal((await w.t.call('GET', '/api/integrations/viasocket/sheets/options?field=spreadsheet', { token: other.token })).status, 409);
    // an employee of the other workspace creating outcomes triggers nothing in ours
    const emp = (await w.t.post('/api/auth/employee/signup', employeeBody(other.workspace.inviteCode))).body;
    await w.t.post('/api/tasks', { title: 'Other workspace work', deadline: '2999-01-01', impact: 3, criteria: ['Done well'], proofPlan: 'A link to it' }, { token: emp.token });
    await w.t.connect.idle();
    assert.equal(w.f.runs().length, 0);
  } finally {
    await w.t.close();
  }
});

test('the webhook outbox keeps working next to Connect', async () => {
  const http = await import('node:http');
  const hits = [];
  const server = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => (b += c));
    req.on('end', () => (hits.push(JSON.parse(b)), res.writeHead(200).end('{}')));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  server.unref();
  const f = fakeVia();
  const t = await startApp({ via: f.via, env: { ALLOW_PRIVATE_WEBHOOKS: '1' } });
  try {
    const admin = (await t.post('/api/auth/admin/signup', adminBody())).body;
    const eli = (await t.post('/api/auth/employee/signup', employeeBody(admin.workspace.inviteCode))).body;
    assert.equal((await t.call('PUT', '/api/integrations/events', { token: admin.token, body: { url: `http://127.0.0.1:${server.address().port}/hook` } })).status, 200);
    await t.call('POST', '/api/integrations/viasocket/slack/connected', { token: admin.token, body: { authId: AUTH } });
    await t.call('PUT', '/api/integrations/viasocket/slack/target', { token: admin.token, body: { channelId: 'C123', channelName: '#o' } });
    await t.call('PUT', '/api/integrations/viasocket/slack/enabled', { token: admin.token, body: { enabled: true } });
    await t.post('/api/tasks', { title: 'Ship the pricing page', deadline: '2999-01-01', impact: 4, criteria: ['Live'], proofPlan: 'A link to it' }, { token: eli.token });
    await t.outbox.idle();
    await t.connect.idle();
    assert.equal(hits.length, 1);
    assert.equal(hits[0].event, 'task.created');
    assert.equal(f.runs().length, 1);
    const log = (await t.get('/api/integrations', { token: admin.token })).body.activity;
    assert.deepEqual(log.map((a) => a.via ?? 'events').sort(), ['events', 'slack']);
  } finally {
    await t.close();
    server.close();
  }
});

test('PUT /target validates input', async () => {
  const w = await world();
  try {
    await w.A('POST', '/slack/connected', { authId: AUTH });
    assert.equal((await w.A('PUT', '/slack/target', {})).status, 400);
    assert.equal((await w.A('PUT', '/slack/target', { channelId: '' })).status, 400);
    assert.equal((await w.A('PUT', '/slack/enabled', { enabled: 'yes' })).status, 400);
  } finally {
    await w.t.close();
  }
});

test('APPS pins the versions the code was written against', () => {
  assert.deepEqual([APPS.sheets.action, APPS.sheets.version, APPS.slack.action, APPS.slack.version], ['Add_New_Row_to_Sheet', 'v66', 'Send_Message', 'v107']);
});
