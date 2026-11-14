// Flat event payloads for the viaSocket "events" flow (Google Sheets row + Slack message).
// Every field is a plain string/number so the flow's steps can map them directly.

export const EVENT_FIELDS = [
  { name: 'event', example: 'task.created', description: 'task.created, task.status_changed or test.ping (more arrive in later milestones)' },
  { name: 'taskId', example: '3f1c9a52-…', description: 'Unique id of the outcome ("test" for the test event)' },
  { name: 'title', example: 'Ship the Q3 pricing page', description: 'Outcome title' },
  { name: 'owner', example: 'Eli Employee', description: 'Name of the employee who owns it' },
  { name: 'status', example: 'in_progress', description: 'planned, in_progress, in_review or done' },
  { name: 'impact', example: 4, description: 'Impact 1–5 as set by the employee' },
  { name: 'deadline', example: '2026-12-01', description: 'Deadline, YYYY-MM-DD' },
  { name: 'at', example: '2026-11-14T10:15:00.000Z', description: 'When it happened (ISO 8601, UTC)' },
  { name: 'text', example: ':memo: Eli Employee planned “Ship…” (impact 4/5, due 2026-12-01)', description: 'Ready-made one-line message for a Slack step' },
];
export const SHEET_HEADER = EVENT_FIELDS.map((f) => f.name);
export const SLACK_TEMPLATE = '{{text}}';

const LABEL = { planned: 'Planned', in_progress: 'In Progress', in_review: 'In Review', done: 'Done' };
const clip = (s, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function buildEvent(kind, task, ownerName, { from, now = new Date() } = {}) {
  const title = clip(task.title);
  const base = { event: kind, taskId: task.id, title: task.title, owner: ownerName, status: task.status, impact: task.impact, deadline: task.deadline, at: now.toISOString() };
  let text;
  if (kind === 'task.created') text = `:memo: ${ownerName} planned “${title}” (impact ${task.impact}/5, due ${task.deadline})`;
  else if (kind === 'task.status_changed') text = `:arrows_counterclockwise: ${ownerName} moved “${title}” ${LABEL[from] || from} → ${LABEL[task.status] || task.status}`;
  else text = `${ownerName}: ${kind} “${title}”`;
  return { ...base, text };
}

export function testEvent(adminName, now = new Date()) {
  return {
    event: 'test.ping',
    taskId: 'test',
    title: 'Test event from Outcome Ledger',
    owner: adminName,
    status: 'planned',
    impact: 3,
    deadline: now.toISOString().slice(0, 10),
    at: now.toISOString(),
    text: `:white_check_mark: Test event from Outcome Ledger, sent by ${adminName}. If you can read this, the flow works.`,
  };
}
