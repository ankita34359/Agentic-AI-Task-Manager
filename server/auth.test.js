import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { startApp, adminBody, employeeBody } from './test-helpers.js';

async function withApp(fn, opts) {
  const app = await startApp(opts);
  try {
    await fn(app);
  } finally {
    await app.close();
  }
}

async function signupAdmin(app, over) {
  const body = adminBody(over);
  const res = await app.post('/api/auth/admin/signup', body);
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { ...res.body, creds: { email: body.email.toLowerCase(), password: body.password } };
}

// ───────────────────────── admin sign-up ─────────────────────────
test('admin sign-up creates a workspace, an invite code and a usable session', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app);
    assert.equal(a.user.role, 'admin');
    assert.match(a.workspace.inviteCode, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.ok(a.token.split('.').length === 3);

    const me = await app.get('/api/me', { token: a.token });
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, a.creds.email);
    assert.equal(me.body.workspace.inviteCode, a.workspace.inviteCode);
  });
});

test('API responses never contain password hashes', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app);
    const e = (await app.post('/api/auth/employee/signup', employeeBody(a.workspace.inviteCode))).body;
    for (const res of [
      await app.get('/api/me', { token: a.token }),
      await app.get('/api/team', { token: a.token }),
      await app.post('/api/auth/login', a.creds),
    ]) {
      assert.ok(!JSON.stringify(res.body).includes('passwordHash'));
      assert.ok(!JSON.stringify(res.body).includes('$2'), 'no bcrypt hash in output');
    }
    assert.ok(!JSON.stringify(e).includes('passwordHash'));
  });
});

test('passwords are stored as bcrypt hashes, not plaintext', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app);
    const stored = app.db.userByEmail(a.creds.email);
    assert.match(stored.passwordHash, /^\$2[aby]\$10\$/);
    assert.notEqual(stored.passwordHash, a.creds.password);
  });
});

test('validation: bad email, short/long password, missing fields', async () => {
  await withApp(async (app) => {
    const cases = [
      [{ email: 'not-an-email' }, 'email'],
      [{ password: 'short' }, 'password'],
      [{ password: 'x'.repeat(80) }, 'password'], // > 72 bytes: bcrypt would silently truncate
      [{ workspaceName: 'A' }, 'workspaceName'],
      [{ name: '' }, 'name'],
      [{ name: 'bad\u0000name' }, 'name'],
    ];
    for (const [over, field] of cases) {
      const res = await app.post('/api/auth/admin/signup', adminBody(over));
      assert.equal(res.status, 400, JSON.stringify(over));
      assert.equal(res.body.error, 'validation_error');
      assert.ok(res.body.fields[field], `expected an error on ${field}`);
    }
    assert.equal((await app.post('/api/auth/admin/signup', {})).status, 400);
    assert.equal(app.db.data.users.length, 0, 'nothing was created');
  });
});

test('emails are unique across workspaces, case-insensitively', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app, { email: 'Boss@Acme.test' });
    assert.equal(a.user.email, 'boss@acme.test');
    const dup = await app.post('/api/auth/admin/signup', adminBody({ email: 'BOSS@acme.TEST', workspaceName: 'Other Co' }));
    assert.equal(dup.status, 409);
    assert.equal(dup.body.error, 'email_taken');
    const dup2 = await app.post('/api/auth/employee/signup', employeeBody(a.workspace.inviteCode, { email: 'boss@acme.test' }));
    assert.equal(dup2.status, 409);
  });
});

test('racing sign-ups with the same email create exactly one account', async () => {
  await withApp(async (app) => {
    const email = 'race@acme.test';
    const results = await Promise.all(Array.from({ length: 5 }, () => app.post('/api/auth/admin/signup', adminBody({ email }))));
    assert.equal(results.filter((r) => r.status === 201).length, 1);
    assert.equal(results.filter((r) => r.status === 409).length, 4);
    assert.equal(app.db.data.users.filter((u) => u.email === email).length, 1);
  });
});

// ───────────────────────── employee sign-up ─────────────────────────
test('employee joins with the invite code (case, spaces and hyphen are forgiven)', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app);
    const code = a.workspace.inviteCode; // XXXX-XXXX
    const sloppy = ` ${code.toLowerCase().replace('-', ' - ')} `;
    const check = await app.get(`/api/auth/invite/${encodeURIComponent(sloppy)}`);
    assert.deepEqual(check.body, { valid: true, workspaceName: 'Acme Inc' });

    const res = await app.post('/api/auth/employee/signup', employeeBody(sloppy));
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, 'employee');
    assert.equal(res.body.user.workspaceId, a.user.workspaceId);
    assert.equal(res.body.workspace.inviteCode, undefined, 'employees never see the invite code');
  });
});

test('invalid invite codes are rejected without creating anything', async () => {
  await withApp(async (app) => {
    await signupAdmin(app);
    for (const bad of ['', 'ABCD-EFGH', 'AAAAAAAA', '!!!', 'x'.repeat(30)]) {
      const res = await app.post('/api/auth/employee/signup', employeeBody(bad));
      assert.ok([400].includes(res.status), `status ${res.status} for "${bad}"`);
      assert.ok(res.body.fields.inviteCode);
    }
    assert.equal(app.db.data.users.length, 1);
    assert.deepEqual((await app.get('/api/auth/invite/ABCD-EFGH')).body, { valid: false });
  });
});

// ───────────────────────── login ─────────────────────────
test('login works, and unknown email vs wrong password are indistinguishable', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app);
    const ok = await app.post('/api/auth/login', { email: a.creds.email.toUpperCase(), password: a.creds.password });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.user.role, 'admin');

    const wrong = await app.post('/api/auth/login', { email: a.creds.email, password: 'nope-nope-nope' });
    const unknown = await app.post('/api/auth/login', { email: 'ghost@nowhere.test', password: 'nope-nope-nope' });
    const garbage = await app.post('/api/auth/login', { email: 42, password: null });
    for (const r of [wrong, unknown, garbage]) {
      assert.equal(r.status, 401);
      assert.deepEqual(r.body, { error: 'invalid_credentials' });
    }
  });
});

// ───────────────────────── tokens ─────────────────────────
test('requests without a valid token are rejected', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app);
    assert.equal((await app.get('/api/me')).status, 401);
    assert.equal((await app.get('/api/me', { token: 'garbage' })).status, 401);
    assert.equal((await app.get('/api/me', { headers: { authorization: `Basic ${a.token}` } })).status, 401);

    // tampered signature
    const [h, p, s] = a.token.split('.');
    assert.equal((await app.get('/api/me', { token: `${h}.${p}.${s.slice(0, -2)}xx` })).status, 401);
    // signed with a different secret
    const forged = jwt.sign({ role: 'admin', ws: a.user.workspaceId }, 'attacker-secret-attacker-secret-1234', { subject: a.user.id, algorithm: 'HS256' });
    assert.equal((await app.get('/api/me', { token: forged })).status, 401);
  });
});

test('alg:none tokens are rejected', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app);
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: a.user.id, role: 'admin', ws: a.user.workspaceId, exp: Math.floor(Date.now() / 1000) + 600 })}.`;
    assert.equal((await app.get('/api/me', { token: none })).status, 401);
  });
});

test('expired tokens are rejected', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app);
    const expired = jwt.sign({ role: 'admin', ws: a.user.workspaceId }, app.config.jwtSecret, { subject: a.user.id, algorithm: 'HS256', expiresIn: -10 });
    assert.equal((await app.get('/api/me', { token: expired })).status, 401);
  });
});

test('a valid token is useless once the user is gone, or when its role claim is forged', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app);
    const e = (await app.post('/api/auth/employee/signup', employeeBody(a.workspace.inviteCode))).body;

    // employee token re-signed (with the real secret, e.g. a leaked key scenario) claiming admin: DB says employee → rejected
    const escalated = jwt.sign({ role: 'admin', ws: e.user.workspaceId }, app.config.jwtSecret, { subject: e.user.id, algorithm: 'HS256' });
    assert.equal((await app.get('/api/team', { token: escalated })).status, 401);

    app.db.data.users = app.db.data.users.filter((u) => u.id !== e.user.id);
    assert.equal((await app.get('/api/me', { token: e.token })).status, 401);
  });
});

// ───────────────────────── roles & tenant isolation ─────────────────────────
test('role guard: employees cannot use admin endpoints', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app);
    const e = (await app.post('/api/auth/employee/signup', employeeBody(a.workspace.inviteCode))).body;
    assert.equal((await app.get('/api/team', { token: e.token })).status, 403);
    assert.equal((await app.post('/api/workspace/invite/regenerate', {}, { token: e.token })).status, 403);
    assert.equal((await app.get('/api/team', { token: a.token })).status, 200);
  });
});

test('tenant isolation: an admin only ever sees their own workspace', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app, { workspaceName: 'Alpha Co' });
    const b = await signupAdmin(app, { workspaceName: 'Beta Co' });
    const ea = (await app.post('/api/auth/employee/signup', employeeBody(a.workspace.inviteCode, { name: 'Alpha Eve' }))).body;
    const eb = (await app.post('/api/auth/employee/signup', employeeBody(b.workspace.inviteCode, { name: 'Beta Bob' }))).body;
    assert.notEqual(a.user.workspaceId, b.user.workspaceId);

    const teamA = (await app.get('/api/team', { token: a.token })).body.members.map((m) => m.name).sort();
    const teamB = (await app.get('/api/team', { token: b.token })).body.members.map((m) => m.name).sort();
    assert.deepEqual(teamA, ['Ada Admin', 'Alpha Eve']);
    assert.deepEqual(teamB, ['Ada Admin', 'Beta Bob']);
    assert.ok(!JSON.stringify(teamA).includes(eb.user.id) && !JSON.stringify(teamB).includes(ea.user.id));

    // A's workspace never leaks B's invite code, and an employee token for A can't be pointed at B
    assert.equal((await app.get('/api/me', { token: ea.token })).body.workspace.name, 'Alpha Co');
    const crossed = jwt.sign({ role: 'admin', ws: b.user.workspaceId }, app.config.jwtSecret, { subject: a.user.id, algorithm: 'HS256' });
    assert.equal((await app.get('/api/team', { token: crossed })).status, 401, 'token claiming another workspace is refused');
  });
});

test('regenerating the invite code kills the old one, for that workspace only', async () => {
  await withApp(async (app) => {
    const a = await signupAdmin(app);
    const b = await signupAdmin(app, { workspaceName: 'Beta Co' });
    const old = a.workspace.inviteCode;

    const res = await app.post('/api/workspace/invite/regenerate', {}, { token: a.token });
    assert.equal(res.status, 200);
    assert.notEqual(res.body.inviteCode, old);

    assert.equal((await app.post('/api/auth/employee/signup', employeeBody(old))).status, 400);
    assert.equal((await app.post('/api/auth/employee/signup', employeeBody(res.body.inviteCode))).status, 201);
    assert.equal((await app.get('/api/me', { token: b.token })).body.workspace.inviteCode, b.workspace.inviteCode, 'other workspace untouched');
  });
});

// ───────────────────────── rate limiting ─────────────────────────
test('failed logins are rate limited (and successful ones are not counted)', async () => {
  const limits = { login: { windowMs: 60_000, limit: 3, skipSuccessful: true }, signup: { windowMs: 60_000, limit: 100 }, invite: { windowMs: 60_000, limit: 100 } };
  await withApp(
    async (app) => {
      const a = await signupAdmin(app);
      for (let i = 0; i < 6; i++) assert.equal((await app.post('/api/auth/login', a.creds)).status, 200, 'good logins never trip the limiter');
      const statuses = [];
      for (let i = 0; i < 5; i++) statuses.push((await app.post('/api/auth/login', { email: a.creds.email, password: 'wrong-wrong-wrong' })).status);
      assert.deepEqual(statuses, [401, 401, 401, 429, 429]);
      assert.deepEqual((await app.post('/api/auth/login', a.creds)).body, { error: 'rate_limited' }, 'locked out until the window passes');
    },
    { limits },
  );
});

test('API responses are not cacheable', async () => {
  await withApp(async (app) => {
    const res = await app.get('/api/health');
    assert.match(res.headers.get('cache-control'), /no-store/);
  });
});
