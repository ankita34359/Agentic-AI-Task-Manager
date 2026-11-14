import test from 'node:test';
import assert from 'node:assert/strict';
import { startApp, adminBody, employeeBody } from './test-helpers.js';
import { checkEmployeeMove, createdToday, dailyLimitState, localDayIndex, STATUSES } from './lib/tasks.js';
import { coach } from './lib/coach.js';

// ───────── state machine (pure) ─────────
test('employee may move Planned <-> In Progress and nothing else', () => {
  assert.deepEqual(checkEmployeeMove('planned', 'in_progress'), { ok: true });
  assert.deepEqual(checkEmployeeMove('in_progress', 'planned'), { ok: true });
});

test('employee can never write Done, from any column', () => {
  for (const from of STATUSES) {
    const r = checkEmployeeMove(from, 'done');
    assert.equal(r.ok, false, `${from} -> done must be refused`);
  }
  assert.equal(checkEmployeeMove('in_review', 'done').reason, 'verified_only');
});

test('In Review is reachable only through proof, never through a plain move', () => {
  assert.equal(checkEmployeeMove('in_progress', 'in_review').reason, 'needs_proof');
  assert.equal(checkEmployeeMove('planned', 'in_review').reason, 'needs_proof');
});

test('cards in review or done cannot be pulled back by the employee', () => {
  assert.equal(checkEmployeeMove('in_review', 'in_progress').ok, false);
  assert.equal(checkEmployeeMove('in_review', 'planned').ok, false);
  assert.equal(checkEmployeeMove('done', 'in_progress').ok, false);
  assert.equal(checkEmployeeMove('done', 'planned').ok, false);
});

test('unknown statuses and no-op moves are refused', () => {
  assert.equal(checkEmployeeMove('planned', 'banana').reason, 'unknown_status');
  assert.equal(checkEmployeeMove('planned', 'planned').reason, 'same_status');
});

// ───────── daily limit (pure) ─────────
test('the day boundary follows the employee timezone', () => {
  // 2025-03-10 22:30 UTC is already 04:00 on the 11th in IST (+330) but still the 10th in UTC.
  const instant = '2025-03-10T22:30:00Z';
  assert.notEqual(localDayIndex(instant, 330), localDayIndex(instant, 0));
  const tasks = [{ ownerId: 'u1', createdAt: '2025-03-10T10:00:00Z' }, { ownerId: 'u1', createdAt: '2025-03-10T23:00:00Z' }, { ownerId: 'u2', createdAt: '2025-03-10T23:00:00Z' }];
  // For an IST user, "now" is the 11th: only the 23:00Z task (04:30 IST on the 11th) counts.
  assert.equal(createdToday(tasks, 'u1', '2025-03-11T01:00:00Z', 330), 1);
  // For a UTC user on the 10th, both of u1's count; u2's never do.
  assert.equal(createdToday(tasks, 'u1', '2025-03-10T23:30:00Z', 0), 2);
  assert.deepEqual(dailyLimitState(tasks, 'u1', '2025-03-10T23:30:00Z', 0), { limit: 3, used: 2, remaining: 1 });
});

// ───────── coach (pure) ─────────
test('coach flags vague wording and missing pieces, and stays quiet on a solid outcome', () => {
  const vague = coach({ title: 'Work on the report' });
  assert.equal(vague.ready, false);
  const codes = vague.flags.map((f) => f.code);
  for (const c of ['vague_wording', 'no_criteria', 'no_proof_plan']) assert.ok(codes.includes(c), c);
  assert.ok(vague.suggestions.length > 0);

  const solid = coach({ title: 'Ship the Q3 pricing page to 100% of visitors', criteria: ['Live on production'], proofPlan: 'Link to the deployed page and a screenshot' });
  assert.equal(solid.ready, true);
  assert.deepEqual(solid.flags, []);
});

// ───────── API ─────────
async function world() {
  const t = await startApp();
  const admin = (await t.post('/api/auth/admin/signup', adminBody())).body;
  const code = admin.workspace.inviteCode;
  const eli = (await t.post('/api/auth/employee/signup', employeeBody(code))).body;
  const mia = (await t.post('/api/auth/employee/signup', employeeBody(code, { name: 'Mia' }))).body;
  return { t, admin, eli, mia };
}
const outcome = (over = {}) => ({
  title: 'Ship the pricing page',
  details: 'Final copy and layout',
  deadline: '2999-01-01',
  impact: 4,
  criteria: ['Page is live on production'],
  proofPlan: 'Link to the live page',
  ...over,
});
const auth = (u) => ({ token: u.token });

test('employee creates an outcome; it starts in Planned and is listed', async () => {
  const { t, eli } = await world();
  const res = await t.post('/api/tasks', outcome(), auth(eli));
  assert.equal(res.status, 201);
  assert.equal(res.body.task.status, 'planned');
  assert.equal(res.body.limit.remaining, 2);
  const list = await t.get('/api/tasks', auth(eli));
  assert.equal(list.body.tasks.length, 1);
  assert.equal(list.body.tasks[0].title, 'Ship the pricing page');
  await t.close();
});

test('the 4th new outcome of the day is refused by the server', async () => {
  const { t, eli, mia } = await world();
  for (let i = 1; i <= 3; i++) assert.equal((await t.post('/api/tasks', outcome({ title: `Outcome number ${i}` }), auth(eli))).status, 201);
  const fourth = await t.post('/api/tasks', outcome({ title: 'Outcome number 4' }), auth(eli));
  assert.equal(fourth.status, 409);
  assert.equal(fourth.body.error, 'daily_limit');
  assert.equal(fourth.body.limit.used, 3);
  assert.equal((await t.get('/api/tasks', auth(eli))).body.tasks.length, 3);
  // The limit is per employee: a colleague still has their own three.
  assert.equal((await t.post('/api/tasks', outcome(), auth(mia))).status, 201);
  await t.close();
});

test('racing creates cannot sneak past the limit', async () => {
  const { t, eli } = await world();
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => t.post('/api/tasks', outcome({ title: `Parallel outcome ${i}` }), auth(eli))));
  assert.equal(results.filter((r) => r.status === 201).length, 3);
  assert.equal(results.filter((r) => r.status === 409).length, 5);
  await t.close();
});

test('the limit follows the stored timezone: yesterday\'s outcomes do not count today', async () => {
  const { t, eli } = await world();
  // Backdate three outcomes by two days; they must not use today's allowance.
  for (let i = 0; i < 3; i++) {
    const r = await t.post('/api/tasks', outcome({ title: `Old outcome ${i}` }), auth(eli));
    t.db.taskById(r.body.task.id).createdAt = new Date(Date.now() - 2 * 86_400_000).toISOString();
  }
  const fresh = await t.post('/api/tasks', outcome({ title: 'Fresh outcome today' }), auth(eli));
  assert.equal(fresh.status, 201);
  assert.equal(fresh.body.limit.used, 1);
  await t.close();
});

test('validation: impact range, criteria required, past deadline, junk', async () => {
  const { t, eli } = await world();
  for (const [over, field] of [
    [{ impact: 0 }, 'impact'],
    [{ impact: 6 }, 'impact'],
    [{ impact: 2.5 }, 'impact'],
    [{ criteria: [] }, 'criteria'],
    [{ proofPlan: '' }, 'proofPlan'],
    [{ title: 'x' }, 'title'],
    [{ deadline: '2000-01-01' }, 'deadline'],
    [{ deadline: '2026-02-31' }, 'deadline'],
    [{ deadline: 'tomorrow' }, 'deadline'],
  ]) {
    const r = await t.post('/api/tasks', outcome(over), auth(eli));
    assert.equal(r.status, 400, JSON.stringify(over));
    assert.ok(r.body.fields[field], `${field} should be reported for ${JSON.stringify(over)}`);
  }
  assert.equal((await t.get('/api/tasks', auth(eli))).body.tasks.length, 0, 'nothing invalid was stored');
  await t.close();
});

test('employee moves a card Planned <-> In Progress over the API', async () => {
  const { t, eli } = await world();
  const { task } = (await t.post('/api/tasks', outcome(), auth(eli))).body;
  const go = await t.post(`/api/tasks/${task.id}/status`, { status: 'in_progress' }, auth(eli));
  assert.equal(go.status, 200);
  assert.equal(go.body.task.status, 'in_progress');
  const back = await t.post(`/api/tasks/${task.id}/status`, { status: 'planned' }, auth(eli));
  assert.equal(back.body.task.status, 'planned');
  // dropping on the same column is a harmless no-op
  assert.equal((await t.post(`/api/tasks/${task.id}/status`, { status: 'planned' }, auth(eli))).status, 200);
  await t.close();
});

test('the API refuses Done and In Review from an employee', async () => {
  const { t, eli } = await world();
  const { task } = (await t.post('/api/tasks', outcome(), auth(eli))).body;
  await t.post(`/api/tasks/${task.id}/status`, { status: 'in_progress' }, auth(eli));
  const done = await t.post(`/api/tasks/${task.id}/status`, { status: 'done' }, auth(eli));
  assert.equal(done.status, 409);
  assert.equal(done.body.error, 'verified_only');
  const review = await t.post(`/api/tasks/${task.id}/status`, { status: 'in_review' }, auth(eli));
  assert.equal(review.status, 409);
  assert.equal(review.body.error, 'needs_proof');
  assert.equal((await t.post(`/api/tasks/${task.id}/status`, { status: 'nonsense' }, auth(eli))).status, 400);
  assert.equal(t.db.taskById(task.id).status, 'in_progress', 'the card never moved');
  await t.close();
});

test('cards that are In Review or Done are frozen for the employee', async () => {
  const { t, eli } = await world();
  const { task } = (await t.post('/api/tasks', outcome(), auth(eli))).body;
  for (const frozen of ['in_review', 'done']) {
    t.db.taskById(task.id).status = frozen;
    for (const to of ['planned', 'in_progress']) {
      const r = await t.post(`/api/tasks/${task.id}/status`, { status: to }, auth(eli));
      assert.equal(r.status, 409, `${frozen} -> ${to}`);
    }
    assert.equal(t.db.taskById(task.id).status, frozen);
  }
  await t.close();
});

test('tenant isolation: nobody else can see, move or coach on someone else\'s outcome', async () => {
  const { t, eli, mia, admin } = await world();
  const { task } = (await t.post('/api/tasks', outcome(), auth(eli))).body;
  // a colleague in the same workspace
  assert.equal((await t.post(`/api/tasks/${task.id}/status`, { status: 'in_progress' }, auth(mia))).status, 404);
  assert.equal((await t.get('/api/tasks', auth(mia))).body.tasks.length, 0);
  // an employee of a different workspace
  const other = (await t.post('/api/auth/admin/signup', adminBody({ workspaceName: 'Other Co' }))).body;
  const stranger = (await t.post('/api/auth/employee/signup', employeeBody(other.workspace.inviteCode))).body;
  assert.equal((await t.post(`/api/tasks/${task.id}/status`, { status: 'in_progress' }, auth(stranger))).status, 404);
  // admins have no employee board
  assert.equal((await t.get('/api/tasks', auth(admin))).status, 403);
  assert.equal((await t.post('/api/tasks', outcome(), auth(admin))).status, 403);
  assert.equal(t.db.taskById(task.id).status, 'planned');
  await t.close();
});

test('endpoints need a token', async () => {
  const { t } = await world();
  assert.equal((await t.get('/api/tasks')).status, 401);
  assert.equal((await t.post('/api/tasks', outcome())).status, 401);
  assert.equal((await t.post('/api/coach', { title: 'x' })).status, 401);
  await t.close();
});

test('POST /api/coach returns flags and suggestions; it stores nothing', async () => {
  const { t, eli } = await world();
  const r = await t.post('/api/coach', { title: 'Look into the onboarding thing' }, auth(eli));
  assert.equal(r.status, 200);
  assert.equal(r.body.ready, false);
  assert.ok(r.body.flags.some((f) => f.code === 'vague_wording'));
  assert.ok(Array.isArray(r.body.suggestions));
  assert.equal(t.db.data.tasks.length, 0);
  await t.close();
});

test('outcomes survive a restart of the database', async () => {
  const { t, eli } = await world();
  await t.post('/api/tasks', outcome(), auth(eli));
  await t.db.flush();
  const { JsonDb } = await import('./db.js');
  assert.equal(JsonDb.open(t.config.dbFile).data.tasks.length, 1);
  await t.close();
});
