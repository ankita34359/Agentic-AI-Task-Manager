import { z } from 'zod';
import { STATUSES } from './tasks.js';

const noControlChars = /^[^\u0000-\u001f\u007f]+$/;

const name = (label, min = 1, max = 60) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} is too long (max ${max})`)
    .regex(noControlChars, `${label} has invalid characters`);

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .max(254, 'Email is too long')
  .email('That does not look like an email')
  .transform((s) => s.toLowerCase());

// bcrypt only looks at the first 72 bytes, so refuse anything longer instead of silently truncating.
const password = z
  .string({ error: 'Password is required' })
  .min(8, 'Use at least 8 characters')
  .refine((s) => Buffer.byteLength(s) <= 72, 'Use at most 72 bytes (about 72 characters)');

// minutes east of UTC (e.g. IST = 330); used later for the "3 new outcomes per day" boundary
const tzOffset = z.number().int().min(-840).max(840).optional().default(0);

export const adminSignupSchema = z.object({
  workspaceName: name('Workspace name', 2),
  name: name('Your name'),
  email,
  password,
  tzOffset,
});

export const employeeSignupSchema = z.object({
  inviteCode: z.string({ error: 'Invite code is required' }).max(40),
  name: name('Your name'),
  email,
  password,
  tzOffset,
});

export const loginSchema = z.object({
  email: z.string().trim().max(254).transform((s) => s.toLowerCase()),
  password: z.string().max(200),
});

/** { field: 'first message' } for the client to show next to inputs. */
export function fieldErrors(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = issue.path[0] ?? '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

// ───────── outcomes ─────────
const text = (label, min, max) =>
  z.string({ error: `${label} is required` }).trim().min(min, min === 0 ? '' : `${label} is required`).max(max, `${label} is too long (max ${max})`).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$/, `${label} has invalid characters`);

export const taskSchema = z.object({
  title: text('Title', 3, 120),
  details: text('Details', 0, 2000).optional().default(''),
  deadline: z.string({ error: 'Deadline is required' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a deadline date').refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s), 'That is not a real date'),
  impact: z.number({ error: 'Impact is required' }).int('Impact is a whole number').min(1, 'Impact is 1 to 5').max(5, 'Impact is 1 to 5'),
  criteria: z.array(text('Criterion', 3, 200)).min(1, 'Add at least one acceptance criterion').max(8, 'At most 8 criteria'),
  proofPlan: text('How you will prove it', 3, 500),
});

export const coachSchema = z.object({
  title: z.string().max(300).optional().default(''),
  details: z.string().max(2000).optional().default(''),
  criteria: z.array(z.string().max(300)).max(12).optional().default([]),
  proofPlan: z.string().max(600).optional().default(''),
});

export const statusSchema = z.object({ status: z.enum(STATUSES, { error: 'Unknown status' }) });
