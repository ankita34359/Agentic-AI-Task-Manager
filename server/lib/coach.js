// Built-in Outcome Coach: plain heuristics, no network. (Milestone 7 can route this through the viaSocket AI flow.)
// It never blocks anything — it only flags vague wording and suggests testable acceptance criteria.

const VAGUE = [
  'work on', 'look into', 'looking into', 'think about', 'investigate', 'research', 'explore', 'try to', 'attempt', 'handle', 'deal with',
  'improve', 'enhance', 'optimize', 'optimise', 'update', 'fix stuff', 'stuff', 'things', 'various', 'misc', 'etc', 'some ', 'better', 'asap', 'continue', 'follow up', 'help with', 'support',
];
const WEAK_VERBS = new Set(['work', 'look', 'think', 'try', 'handle', 'improve', 'update', 'explore', 'research', 'investigate', 'review', 'check', 'support', 'help', 'continue']);
const STRONG_VERBS = ['ship', 'publish', 'deliver', 'launch', 'send', 'merge', 'deploy', 'release', 'write', 'draft', 'close', 'reduce', 'increase', 'migrate', 'fix', 'sign', 'present', 'resolve', 'document', 'schedule', 'finish', 'complete', 'submit', 'cut'];
const MEASURABLE = /(\d|\bpercent\b|%|\ball\b|\bevery\b|\bzero\b|\bnone\b|\bno more\b|\bunder\b|\bbelow\b|\bat least\b|\bby \w+day\b)/i;
const EVIDENCE = /(link|url|screenshot|screen shot|pr\b|pull request|ticket|doc\b|document|report|dashboard|email|recording|demo|commit|build|test|metric|number)/i;

const words = (s) => (s.toLowerCase().match(/[a-z0-9']+/g) || []);

/**
 * @param {{title?:string, details?:string, criteria?:string[], proofPlan?:string}} input
 * @returns {{ready:boolean, flags:{code:string, field:string, message:string}[], suggestions:string[]}}
 */
export function coach({ title = '', details = '', criteria = [], proofPlan = '' } = {}) {
  const flags = [];
  const t = title.trim();
  const lower = ` ${t.toLowerCase()} `;
  const w = words(t);

  if (!t) return { ready: false, flags: [{ code: 'title_missing', field: 'title', message: 'Start with a title: what will exist when this is done?' }], suggestions: [] };

  if (w.length < 3) flags.push({ code: 'title_short', field: 'title', message: 'Very short. Say what changes and for whom.' });
  const hit = VAGUE.find((v) => lower.includes(` ${v.trim()}`) || (v.endsWith(' ') && lower.includes(v)));
  if (hit) flags.push({ code: 'vague_wording', field: 'title', message: `"${hit.trim()}" is hard to prove. Name the result instead of the activity.` });
  if (w[0] && WEAK_VERBS.has(w[0]) && !hit) flags.push({ code: 'weak_verb', field: 'title', message: `"${w[0]}" describes effort, not an outcome. What is finished at the end?` });
  if (!MEASURABLE.test(`${t} ${details}`) && !criteria.some((c) => MEASURABLE.test(c))) flags.push({ code: 'not_measurable', field: 'criteria', message: 'No number, count or deadline in sight. Add something someone could check.' });
  if (criteria.filter((c) => c.trim()).length === 0) flags.push({ code: 'no_criteria', field: 'criteria', message: 'Add at least one acceptance criterion: a sentence that is clearly true or false when you finish.' });
  if (!proofPlan.trim()) flags.push({ code: 'no_proof_plan', field: 'proofPlan', message: 'How will you prove it? A link, a screenshot or a short note all work.' });
  else if (!EVIDENCE.test(proofPlan) && words(proofPlan).length < 4) flags.push({ code: 'proof_vague', field: 'proofPlan', message: 'Be specific about the evidence: what will you attach, and where does it live?' });

  return { ready: flags.length === 0, flags, suggestions: suggest(t, w, criteria) };
}

function suggest(title, w, existing) {
  const have = new Set(existing.map((c) => c.trim().toLowerCase()));
  const noun = title.replace(/^(\w+)\s+/, '').replace(/[.!]+$/, '') || 'this';
  const verb = w.find((x) => STRONG_VERBS.includes(x));
  const out = [];
  out.push(verb ? `${cap(noun)} is ${pastOf(verb)} and the result is visible to the person who asked for it.` : `The result of "${shorten(title)}" exists and can be opened or shown to someone else.`);
  out.push('A named reviewer can confirm it without asking me any questions.');
  out.push('It is finished by the deadline, with nothing left in a "mostly done" state.');
  if (!/\d/.test(title)) out.push('There is at least one number that proves it worked (a count, a time, a percentage).');
  return out.filter((s) => !have.has(s.toLowerCase())).slice(0, 4);
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const shorten = (s) => (s.length > 60 ? `${s.slice(0, 57)}…` : s);
const pastOf = (v) => ({ ship: 'shipped', send: 'sent', write: 'written', draft: 'drafted', close: 'closed', sign: 'signed', cut: 'cut', finish: 'finished', complete: 'completed', submit: 'submitted' })[v] || (v.endsWith('e') ? `${v}d` : `${v}ed`);
