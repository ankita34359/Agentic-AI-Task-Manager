// The four board columns, in order. Mirrors the server's status ids (server/lib/tasks.js).
export const COLUMNS = [
  { id: 'planned', title: 'Planned', color: 'yellow', hint: 'Drag a note to In Progress when you start it.' },
  { id: 'in_progress', title: 'In Progress', color: 'cyan', hint: 'Finished? Drop it on Done to submit proof.' },
  { id: 'in_review', title: 'In Review', color: 'pink', hint: 'Proof is in. The validator takes it from here.' },
  { id: 'done', title: 'Done', color: 'mint', hint: 'Only verified work lands here.' },
];
export const COLUMN_BY_ID = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));

// Notes in these columns belong to the reviewers now; the employee can't drag them.
export const isFrozen = (status) => status === 'in_review' || status === 'done';

/** Employee-side decision for a move request (the server re-checks everything). */
export function planMove(task, to) {
  if (to === task.status) return { kind: 'noop' };
  if (isFrozen(task.status)) return { kind: 'refuse', message: task.status === 'done' ? 'Verified work stays put.' : 'This one is with the reviewers now.' };
  if (to === 'done' || to === 'in_review') {
    return task.status === 'in_progress' ? { kind: 'proof' } : { kind: 'refuse', message: 'Start it first: drag it to In Progress, then submit proof.' };
  }
  return { kind: 'move' }; // planned <-> in_progress
}

export const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

export function formatDeadline(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
export const isOverdue = (task) => !isFrozen(task.status) && task.deadline < todayLocal();
