import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

/**
 * The always-moving backdrop: drifting clouds, twinkling stars, floating doodles, a static halftone.
 * 3 clouds + 6 stars + 6 doodles = 15 animated nodes, all transform/opacity. Three parallax layers
 * move at different speeds with scroll. On "calm" pages (CSS: html[data-ambient=calm]) it fades back,
 * slows down and drops the extras so numbers stay readable. Paused in hidden tabs via CSS.
 */
const CLOUDS = [
  { top: '9%', scale: 1.1, dur: 150, delay: -40 },
  { top: '38%', scale: 0.7, dur: 110, delay: -85, extra: true },
  { top: '66%', scale: 0.9, dur: 180, delay: -120 },
];
const STARS = [
  { left: '8%', top: '14%', s: 26, color: 'var(--y)' },
  { left: '88%', top: '10%', s: 20, color: 'var(--cyan)' },
  { left: '72%', top: '46%', s: 16, color: 'var(--pink)', extra: true },
  { left: '1%', top: '60%', s: 20, color: 'var(--cyan)', extra: true },
  { left: '93%', top: '72%', s: 24, color: 'var(--y)' },
  { left: '46%', top: '88%', s: 18, color: 'var(--pink)', extra: true },
];
// Doodles must never sit behind page text. Rules (enforced in CSS, checked by a browser test):
//  - 'l' doodles live in the left gutter, outside the content column, and only show on wide screens (>= 1280px)
//  - 'r' doodles live in the right half (artwork side), where there is no headline
//  - nothing shows below 961px, where the single-column headline spans the whole width
const DOODLES = [
  { kind: 'squiggle', side: 'l', left: '0.5%', top: '15%', rot: -8 },
  { kind: 'bolt', side: 'l', left: '0.5%', top: '74%', rot: 14, extra: true },
  { kind: 'spiral', side: 'r', left: '92%', top: '30%', rot: 10 },
  { kind: 'heart', side: 'r', left: '80%', top: '88%', rot: -10, extra: true },
  { kind: 'plus', side: 'r', left: '66%', top: '9%', rot: 12 },
  { kind: 'ring', side: 'r', left: '55%', top: '4%', rot: 0, extra: true },
];

function Cloud() {
  return (
    <svg viewBox="0 0 160 84" width="190" height="100" aria-hidden="true">
      <path
        d="M28 70 C8 70 4 46 24 42 C22 22 46 12 60 24 C68 4 102 4 108 26 C128 18 148 34 138 52 C154 54 154 70 138 70 Z"
        className="amb-cloud"
      />
    </svg>
  );
}

function Star({ s, color }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} aria-hidden="true">
      <path d="M12 1 C13 9 15 11 23 12 C15 13 13 15 12 23 C11 15 9 13 1 12 C9 11 11 9 12 1Z" fill={color} className="amb-star" />
    </svg>
  );
}

function Doodle({ kind }) {
  const common = { fill: 'none', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', className: 'amb-doodle' };
  return (
    <svg viewBox="0 0 48 48" width="52" height="52" aria-hidden="true">
      {kind === 'squiggle' && <path d="M4 30 Q10 14 16 30 T28 30 T40 30" {...common} stroke="var(--pink)" />}
      {kind === 'spiral' && <path d="M24 24 m0 0 c0-3 4-3 4 0 s-2 7 -8 6 s-7 -10 0 -14 s16 2 14 12 s-16 16 -26 6" {...common} stroke="var(--cyan)" />}
      {kind === 'bolt' && <path d="M26 4 L10 28 H22 L18 44 L38 18 H26 Z" {...common} fill="var(--y)" stroke="var(--ink-fixed)" strokeWidth="2.5" />}
      {kind === 'heart' && <path d="M24 40 C2 24 10 6 24 16 C38 6 46 24 24 40Z" {...common} fill="var(--pink)" stroke="var(--ink-fixed)" strokeWidth="2.5" />}
      {kind === 'plus' && <path d="M24 8 V40 M8 24 H40" {...common} stroke="var(--mint)" strokeWidth="5" />}
      {kind === 'ring' && <circle cx="24" cy="24" r="13" {...common} stroke="var(--orange)" strokeWidth="5" />}
    </svg>
  );
}

export default function Ambient() {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1600], [0, -90]);
  const y2 = useTransform(scrollY, [0, 1600], [0, -200]);
  const y3 = useTransform(scrollY, [0, 1600], [0, -340]);
  const still = reduced ? { y: 0 } : null;

  return (
    <div className="ambient" aria-hidden="true">
      <div className="ambient__dots" />
      <motion.div className="ambient__layer" style={still || { y: y1 }}>
        {CLOUDS.map((c, i) => (
          <div
            key={i}
            className={`amb-cloud-wrap${c.extra ? ' amb-extra' : ''}`}
            style={{ top: c.top, '--d': `${c.dur}s`, animationDelay: `${c.delay}s`, '--cs': c.scale }}
          >
            <Cloud />
          </div>
        ))}
      </motion.div>
      <motion.div className="ambient__layer" style={still || { y: y2 }}>
        {STARS.map((s, i) => (
          <span key={i} className={`amb-star-wrap${s.extra ? ' amb-extra' : ''}`} style={{ left: s.left, top: s.top, '--d': `${3.2 + i * 0.7}s`, animationDelay: `${-i * 0.9}s` }}>
            <Star s={s.s} color={s.color} />
          </span>
        ))}
      </motion.div>
      <motion.div className="ambient__layer" style={still || { y: y3 }}>
        {DOODLES.map((d, i) => (
          <span
            key={i}
            className={`amb-doodle-wrap amb-doodle-wrap--${d.side}${d.extra ? ' amb-extra' : ''}`}
            style={{ left: d.left, top: d.top, '--rot': `${d.rot}deg`, '--d': `${9 + i * 1.6}s`, animationDelay: `${-i * 1.7}s` }}
          >
            <Doodle kind={d.kind} />
          </span>
        ))}
      </motion.div>
    </div>
  );
}
