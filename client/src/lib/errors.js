import { pickLine } from './lines.js';

// Human, slightly cheeky, never blaming the user.
const COPY = {
  email_taken: 'That email already has an account. Try logging in instead?',
  invalid_credentials: 'Wrong email or password. Tally checked twice.',
  invalid_invite: "That invite code doesn't match any workspace. Typo?",
  rate_limited: 'Easy there! Too many tries. Take a breath and try again in a few minutes.',
  network: "Can't reach the server. Is your connection napping?",
  unauthorized: 'Your session ended. Please log in again.',
  forbidden: "You don't have access to that.",
  validation_error: 'A few fields need another look.',
};

export const errorMessage = (err, tone = 'playful') => COPY[err?.code] || pickLine('error', tone);
