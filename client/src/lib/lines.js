/**
 * All the microcopy lives here so tone stays consistent.
 * `playful` is the default; `calm` is used on admin pages (a little less jokey, still human).
 * Keep it funny but work-appropriate.
 */
export const LINES = {
  tagline: {
    playful: [
      'Busy is not the same as valuable.',
      'Three tasks. Make them count.',
      'Your to-do list called. It wants fewer friends.',
      "Proof or it didn't happen.",
      'Done is a claim. Verified is a fact.',
      'Fewer tasks, bigger wins.',
      'Be famous for outcomes, not for inbox zero.',
      "If it can't be proven, it can't be scored.",
      'Sixteen points a week. No pressure. (Some pressure.)',
    ],
    calm: ['Outcomes over output.', 'Verified impact, week by week.', 'What shipped, and what mattered.'],
  },
  mascot: {
    playful: [
      "Hi! I'm Tally.",
      'I count what counts.',
      'Poke me. I dare you.',
      "Show me the proof and I'll show you the stamp.",
      'Psst — impact 5 is not a personality.',
    ],
    calm: ["Hi, I'm Tally.", 'Proof in, verdicts out.'],
  },
  marquee: {
    playful: [
      'Busy is not the same as valuable.',
      'Plan less. Prove more.',
      "Proof or it didn't happen.",
      'A task is not an outcome.',
      'Three tasks. Make them count.',
      'Gold stars are for verified work.',
      'Sticky notes, now with consequences.',
      'Rework happens. Tally still believes in you.',
      'Your to-do list called. It wants fewer friends.',
      'Done is a claim. Verified is a fact.',
    ],
    calm: ['Outcomes over output.', 'Verified impact, week by week.'],
  },
  empty: {
    playful: [
      'Nothing here yet. Suspiciously peaceful.',
      'Tumbleweed. Add an outcome?',
      'Tally looked everywhere. Nothing. Add something that matters.',
      'An empty board is a blank canvas. Or a nap. Your call.',
    ],
    calm: ['Nothing to show yet.', 'No items right now.'],
  },
  loading: {
    playful: ['Sharpening pencils…', 'Asking the ink nicely…', 'Counting what counts…', 'Warming up the stamp pad…'],
    calm: ['Loading…', 'Fetching the latest…'],
  },
  success: {
    playful: ['Nice! That one counts.', 'Verified. Take a bow.', 'Saved. Future-you says thanks.', 'Stamped and sealed.'],
    calm: ['Saved.', 'Done.', 'Updated.'],
  },
  error: {
    playful: [
      "Oops. That wasn't supposed to happen.",
      'Tally tripped over a cable. Try again?',
      "Something broke. It wasn't you. Probably.",
    ],
    calm: ['Something went wrong. Please try again.', "That didn't work. Try again in a moment."],
  },
  limit: {
    playful: [
      "That's three. Pick winners, not volume.",
      'Daily limit reached — quality over quantity. More tomorrow.',
      "Three is the magic number. Tomorrow-you can have more.",
    ],
    calm: ['Daily limit of three new outcomes reached.'],
  },
  rework: {
    playful: [
      'Almost! Needs a little more proof.',
      'Back to the drawing board — with better pencils.',
      "Close, but the stamp isn't dry. A bit more proof, please.",
    ],
    calm: ['More proof needed before this can be verified.'],
  },
  verified: {
    playful: ['VERIFIED! Gold star incoming.', 'Proof accepted. Confetti authorised.', 'That one counts. Take a bow.'],
    calm: ['Verified.'],
  },
  thinking: {
    playful: ['Hmm… reading your proof…', 'Checking it against the criteria…', 'Squinting at the evidence…'],
    calm: ['Reviewing the proof…'],
  },
  transition: {
    playful: ['Turning the page…', 'Flip!', 'Next panel…', 'Rip!'],
    calm: ['Loading…'],
  },
  notfound: {
    playful: ['That page wandered off the panel.', 'Nobody here but us ink blots.'],
    calm: ["We couldn't find that page."],
  },
  footer: {
    playful: ['Made with ink, caffeine and strong opinions.', 'No tasks were harmed. Several were deleted.', 'Measure value, not volume.'],
    calm: ['Measure value, not volume.'],
  },
};

export const BURSTS = {
  success: ['POW!', 'NICE!', 'ZAP!', 'BOOM!', 'YES!'],
  error: ['OOPS!', 'UH-OH!', 'WHOOPS!'],
};

const rand = (n) => Math.floor(Math.random() * n);

/** Pick one line, avoiding `exclude` (so rotation never repeats back-to-back). */
export function pickLine(kind, tone = 'playful', exclude) {
  const pool = LINES[kind]?.[tone] || LINES[kind]?.playful || [''];
  if (pool.length === 1) return pool[0];
  let line;
  do {
    line = pool[rand(pool.length)];
  } while (line === exclude);
  return line;
}

/** Pick `n` distinct lines (shuffled). */
export function pickMany(kind, n, tone = 'playful') {
  const pool = [...(LINES[kind]?.[tone] || LINES[kind]?.playful || [])];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

export const pickBurst = (kind = 'success') => BURSTS[kind][rand(BURSTS[kind].length)];
