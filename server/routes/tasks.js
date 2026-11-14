import crypto from 'node:crypto';
import express from 'express';
import { requireRole } from '../middleware.js';
import { checkEmployeeMove, createdToday, dailyLimitState, DAILY_LIMIT, localDayIndex } from '../lib/tasks.js';
import { coach } from '../lib/coach.js';
import { buildEvent } from '../lib/events.js';
import { coachSchema, fieldErrors, statusSchema, taskSchema } from '../lib/schemas.js';

// What the client may see of a task. (Proofs/verdicts join this shape in milestone 5.)
const taskView = (t) => ({
  id: t.id,
  title: t.title,
  details: t.details,
  deadline: t.deadline,
  impact: t.impact,
  criteria: t.criteria,
  proofPlan: t.proofPlan,
  status: t.status,
  reworkCount: t.reworkCount,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});

const MOVE_ERRORS = {
  unknown_status: [400, 'validation_error'],
  needs_proof: [409, 'needs_proof'], // In Review is reached only by submitting proof
  verified_only: [409, 'verified_only'], // Done is reached only through verification
  not_allowed: [409, 'move_not_allowed'],
};

/** Employee-only outcome endpoints. Every lookup is scoped to the caller (ownerId), so another employee's task id is just a 404. */
export function taskRoutes({ db, auth, outbox }) {
  const r = express.Router();
  const employee = [auth, requireRole('employee')];

  r.get('/tasks', ...employee, (req, res) => {
    const tasks = db.tasksOfUser(req.user.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    res.json({ tasks: tasks.map(taskView), limit: dailyLimitState(db.data.tasks, req.user.id, new Date(), req.user.tzOffset) });
  });

  r.post('/tasks', ...employee, async (req, res) => {
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'validation_error', fields: fieldErrors(parsed.error) });
    const now = new Date();
    const tz = req.user.tzOffset;

    // Checked and written with no await in between, so two racing requests cannot both take the last slot.
    if (createdToday(db.data.tasks, req.user.id, now, tz) >= DAILY_LIMIT) {
      return res.status(409).json({ error: 'daily_limit', limit: dailyLimitState(db.data.tasks, req.user.id, now, tz) });
    }
    // Deadline can't be before the employee's own today.
    const todayStr = new Date(localDayIndex(now, tz) * 86_400_000).toISOString().slice(0, 10);
    if (parsed.data.deadline < todayStr) return res.status(400).json({ error: 'validation_error', fields: { deadline: 'That date has already passed' } });

    const iso = now.toISOString();
    const task = { id: crypto.randomUUID(), workspaceId: req.user.workspaceId, ownerId: req.user.id, ...parsed.data, status: 'planned', reworkCount: 0, createdAt: iso, updatedAt: iso };
    db.data.tasks.push(task);
    await db.commit();
    outbox?.enqueue(req.user.workspaceId, buildEvent('task.created', task, req.user.name, { now }));
    res.status(201).json({ task: taskView(task), limit: dailyLimitState(db.data.tasks, req.user.id, now, tz) });
  });

  r.post('/tasks/:id/status', ...employee, async (req, res) => {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'validation_error', fields: fieldErrors(parsed.error) });
    const task = db.taskById(req.params.id);
    if (!task || task.ownerId !== req.user.id) return res.status(404).json({ error: 'not_found' });

    const to = parsed.data.status;
    if (to === task.status) return res.json({ task: taskView(task) }); // dropped back where it was: nothing to do
    const verdict = checkEmployeeMove(task.status, to);
    if (!verdict.ok) {
      const [status, error] = MOVE_ERRORS[verdict.reason] || [409, 'move_not_allowed'];
      return res.status(status).json({ error, from: task.status, to });
    }
    const from = task.status;
    task.status = to;
    task.updatedAt = new Date().toISOString();
    await db.commit();
    outbox?.enqueue(req.user.workspaceId, buildEvent('task.status_changed', task, req.user.name, { from }));
    res.json({ task: taskView(task) });
  });

  // Outcome Coach: pure heuristics, nothing is stored.
  r.post('/coach', ...employee, (req, res) => {
    const parsed = coachSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'validation_error', fields: fieldErrors(parsed.error) });
    res.json(coach(parsed.data));
  });

  return r;
}
