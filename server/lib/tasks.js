// Pure task rules: the status state machine and the daily limit. No I/O, so they are cheap to unit-test.

export const STATUSES = ['planned', 'in_progress', 'in_review', 'done'];
export const DAILY_LIMIT = 3;

/**
 * Who may move a card where. Anything not listed here is refused.
 *  - employee: Planned <-> In Progress only (the board's drag)
 *  - In Progress -> In Review happens only through proof submission (milestone 5), never through a plain move
 *  - In Review -> Done only through a validator "verify" or an admin approval (milestone 5)
 *  - In Review -> In Progress (rework) only through a validator "ask" or an admin "needs rework" (milestone 5)
 * So in this milestone the only plain moves that exist are the two employee ones below.
 */
const EMPLOYEE_MOVES = { planned: ['in_progress'], in_progress: ['planned'] };

/** @returns {{ok:true}|{ok:false, reason:string}} reason: unknown_status | same_status | needs_proof | verified_only | not_allowed */
export function checkEmployeeMove(from, to) {
  if (!STATUSES.includes(to) || !STATUSES.includes(from)) return { ok: false, reason: 'unknown_status' };
  if (from === to) return { ok: false, reason: 'same_status' };
  if (to === 'done') return { ok: false, reason: 'verified_only' }; // employees can never write Done
  if (to === 'in_review') return { ok: false, reason: 'needs_proof' }; // only a proof submission gets a card there
  if (EMPLOYEE_MOVES[from]?.includes(to)) return { ok: true };
  return { ok: false, reason: 'not_allowed' }; // e.g. anything leaving In Review or Done
}

// ───────── daily limit ─────────
// A "day" is the employee's own calendar day. tzOffset = minutes east of UTC (IST = 330), stored at sign-up.
const DAY_MS = 86_400_000;
export const localDayIndex = (date, tzOffset = 0) => Math.floor((new Date(date).getTime() + tzOffset * 60_000) / DAY_MS);

export function createdToday(tasks, userId, now, tzOffset = 0) {
  const today = localDayIndex(now, tzOffset);
  return tasks.filter((t) => t.ownerId === userId && localDayIndex(t.createdAt, tzOffset) === today).length;
}

export function dailyLimitState(tasks, userId, now, tzOffset = 0) {
  const used = createdToday(tasks, userId, now, tzOffset);
  return { limit: DAILY_LIMIT, used, remaining: Math.max(0, DAILY_LIMIT - used) };
}
