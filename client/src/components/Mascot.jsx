import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { subscribePointer } from '../lib/pointer.js';
import { useIdle } from '../lib/hooks.js';
import { useBurst } from './Burst.jsx';
import Confetti from './Confetti.jsx';

/**
 * Tally — the Outcome Ledger mascot. An original character: a round mint ink-blob with a
 * check-mark antenna, stubby arms and a very opinionated face.
 *
 * mood: idle | wave | think | cheer | shrug | sleep
 *  - idle   blinks + bobs, eyes follow the cursor; falls asleep after `sleepAfter` ms of no activity
 *  - wave   greets on mount for ~3 s when `greet` is on (page enter), then settles to `mood`
 *  - think  while the AI validates proof (dots, eyes up, hand on chin)
 *  - cheer  verified! jumps + confetti
 *  - shrug  needs rework
 *  - sleep  zzz
 * Poses are CSS-driven (data-mood), so the component re-renders almost never.
 */
const POKES = ['HEE!', 'BOING!', 'POKE!', 'TEE-HEE!'];
const BODY = 'M110 44 C64 44 38 94 38 142 C38 192 70 218 110 218 C150 218 182 192 182 142 C182 94 156 44 110 44 Z';

function Arm({ side }) {
  const left = side === 'l';
  const d = left ? 'M50 132 Q30 136 26 162' : 'M170 132 Q190 136 194 162';
  const [hx, hy] = left ? [26, 162] : [194, 162];
  return (
    <g className={`m-arm m-arm--${side}`} style={{ transformOrigin: left ? '50px 132px' : '170px 132px' }}>
      <path d={d} className="m-ink" strokeWidth="17" fill="none" strokeLinecap="round" />
      <path d={d} className="m-skin-stroke" strokeWidth="9" fill="none" strokeLinecap="round" />
      <circle cx={hx} cy={hy} r="10.5" className="m-skin m-line" />
    </g>
  );
}

function Eyes({ mood, pupilsRef }) {
  if (mood === 'cheer')
    return (
      <g className="m-eyes-happy" fill="none" strokeLinecap="round">
        <path d="M70 126 Q86 104 102 126" className="m-ink" strokeWidth="6" />
        <path d="M118 126 Q134 104 150 126" className="m-ink" strokeWidth="6" />
      </g>
    );
  if (mood === 'sleep')
    return (
      <g className="m-eyes-closed" fill="none" strokeLinecap="round">
        <path d="M70 120 Q86 134 102 120" className="m-ink" strokeWidth="6" />
        <path d="M118 120 Q134 134 150 120" className="m-ink" strokeWidth="6" />
      </g>
    );
  return (
    <g className="m-eyes">
      <ellipse cx="86" cy="120" rx="17" ry="20" className="m-white m-line" />
      <ellipse cx="134" cy="120" rx="17" ry="20" className="m-white m-line" />
      <g className="m-pupils" ref={pupilsRef}>
        <circle cx="86" cy="121" r="8.5" className="m-pupil" />
        <circle cx="134" cy="121" r="8.5" className="m-pupil" />
        <circle cx="89" cy="117" r="2.8" fill="#fff" />
        <circle cx="137" cy="117" r="2.8" fill="#fff" />
      </g>
    </g>
  );
}

function Brows({ mood }) {
  if (mood === 'shrug')
    return (
      <g fill="none" strokeLinecap="round" className="m-ink" strokeWidth="5">
        <path d="M68 100 L100 88" />
        <path d="M120 88 L152 100" />
      </g>
    );
  if (mood === 'think')
    return (
      <g fill="none" strokeLinecap="round" className="m-ink" strokeWidth="5">
        <path d="M70 96 L100 96" />
        <path d="M120 92 Q136 80 152 92" />
      </g>
    );
  return null;
}

function Mouth({ mood }) {
  switch (mood) {
    case 'wave':
      return (
        <g>
          <path d="M92 148 Q110 180 128 148 Z" className="m-mouth-in m-line" strokeWidth="5" strokeLinejoin="round" />
          <path d="M101 164 Q110 172 119 164 Q110 158 101 164Z" className="m-tongue" />
        </g>
      );
    case 'cheer':
      return (
        <g>
          <path d="M84 146 Q110 192 136 146 Z" className="m-mouth-in m-line" strokeWidth="5" strokeLinejoin="round" />
          <path d="M97 168 Q110 182 123 168 Q110 158 97 168Z" className="m-tongue" />
        </g>
      );
    case 'think':
      return <ellipse cx="120" cy="158" rx="6" ry="7" className="m-mouth-in m-line" strokeWidth="4.5" />;
    case 'shrug':
      return <path d="M92 160 q9 -8 18 0 t18 0" className="m-ink" strokeWidth="5" fill="none" strokeLinecap="round" />;
    case 'sleep':
      return <ellipse cx="110" cy="158" rx="5.5" ry="6.5" className="m-mouth-in m-line m-snore" strokeWidth="4.5" />;
    default:
      return <path d="M94 150 Q110 166 126 150" className="m-ink" strokeWidth="5.5" fill="none" strokeLinecap="round" />;
  }
}

export default function Mascot({
  mood = 'idle',
  size = 220,
  greet = true,
  autoSleep = true,
  sleepAfter = 45000,
  interactive = true,
  className = '',
  label = 'Tally, the Outcome Ledger mascot',
}) {
  const reduced = useReducedMotion();
  const fire = useBurst();
  const uid = useId().replace(/:/g, '');
  const svgRef = useRef(null);
  const pupilsRef = useRef(null);
  const [greeting, setGreeting] = useState(greet && mood === 'idle');
  const sleepy = useIdle(sleepAfter, autoSleep && mood === 'idle');

  // Wave hello on page enter, then settle.
  useEffect(() => {
    if (!greeting) return undefined;
    const t = setTimeout(() => setGreeting(false), 3000);
    return () => clearTimeout(t);
  }, [greeting]);

  const effective = mood !== 'idle' ? mood : greeting ? 'wave' : sleepy ? 'sleep' : 'idle';

  // Eyes follow the cursor (shared rAF-throttled listener, direct DOM write → no re-renders).
  useEffect(() => {
    if (reduced) return undefined;
    return subscribePointer((x, y) => {
      const svg = svgRef.current;
      const pupils = pupilsRef.current;
      if (!svg || !pupils) return;
      const r = svg.getBoundingClientRect();
      if (!r.width) return;
      const cx = r.left + r.width * 0.5;
      const cy = r.top + r.height * (140 / 260);
      const dx = x - cx;
      const dy = y - cy;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 160);
      pupils.style.transform = `translate(${((dx / d) * 6.5 * k).toFixed(2)}px, ${((dy / d) * 5.5 * k).toFixed(2)}px)`;
    });
  }, [reduced]);

  const poke = (e) => {
    if (!interactive) return;
    const r = e.currentTarget.getBoundingClientRect();
    fire(POKES[Math.floor(Math.random() * POKES.length)], { x: e.clientX || r.left + r.width / 2, y: r.top + r.height * 0.15 });
  };

  return (
    <motion.div
      className={`mascot ${className}`}
      data-mood={effective}
      style={{ width: size }}
      onClick={poke}
      whileTap={interactive && !reduced ? { scaleX: 1.08, scaleY: 0.9 } : undefined}
      transition={{ type: 'spring', stiffness: 420, damping: 10 }}
      role="img"
      aria-label={label}
    >
      <svg ref={svgRef} viewBox="0 -20 220 260" width="100%" aria-hidden="true" focusable="false">
        <defs>
          <pattern id={`dots-${uid}`} width="9" height="9" patternUnits="userSpaceOnUse">
            <circle cx="2.5" cy="2.5" r="1.7" fill="rgba(27,21,48,.24)" />
          </pattern>
          <clipPath id={`clip-${uid}`}>
            <path d={BODY} />
          </clipPath>
        </defs>

        <ellipse className="m-ground" cx="110" cy="229" rx="62" ry="9" />

        <g className="m-bob">
          <g className="m-pose">
            <ellipse cx="82" cy="216" rx="21" ry="11" className="m-foot m-line" />
            <ellipse cx="138" cy="216" rx="21" ry="11" className="m-foot m-line" />

            <Arm side="l" />
            <Arm side="r" />

            <g className="m-antenna" style={{ transformOrigin: '110px 46px' }}>
              <path d="M110 48 C106 32 114 22 122 14" className="m-ink" strokeWidth="7" fill="none" strokeLinecap="round" />
              <g className="m-check" style={{ transformOrigin: '124px 14px' }}>
                <path d="M112 8 L122 20 L142 -8" className="m-ink" strokeWidth="14" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M112 8 L122 20 L142 -8" className="m-check-fill" strokeWidth="7" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </g>
            </g>

            <path d={BODY} className="m-skin m-line" strokeWidth="6" strokeLinejoin="round" />
            <g clipPath={`url(#clip-${uid})`}>
              <ellipse cx="110" cy="166" rx="48" ry="44" className="m-belly" />
              <rect x="30" y="118" width="64" height="104" fill={`url(#dots-${uid})`} />
            </g>
            <path d="M60 86 Q53 106 57 126" fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth="7" strokeLinecap="round" />
            <path d={BODY} fill="none" className="m-ink" strokeWidth="6" strokeLinejoin="round" />

            <g className="m-face">
              <ellipse cx="66" cy="148" rx="11" ry="7" className="m-cheek" />
              <ellipse cx="154" cy="148" rx="11" ry="7" className="m-cheek" />
              <Eyes mood={effective} pupilsRef={pupilsRef} />
              <Brows mood={effective} />
              <Mouth mood={effective} />
            </g>
          </g>

          {effective === 'think' && (
            <g className="m-thought">
              <circle cx="160" cy="38" r="4.5" className="m-puff m-line" strokeWidth="3" />
              <circle cx="176" cy="22" r="6.5" className="m-puff m-line" strokeWidth="3" />
              <circle cx="198" cy="-4" r="15" className="m-puff m-line" strokeWidth="3.5" />
              <text x="198" y="2" textAnchor="middle" className="m-q">
                ?
              </text>
            </g>
          )}
          {effective === 'sleep' && (
            <g className="m-zzz">
              <text x="152" y="50" className="m-z m-z1">Z</text>
              <text x="170" y="26" className="m-z m-z2">Z</text>
              <text x="190" y="2" className="m-z m-z3">Z</text>
            </g>
          )}
          {effective === 'shrug' && (
            <path d="M166 66 C161 76 159 81 166 86 C173 81 171 76 166 66Z" className="m-sweat m-line" strokeWidth="3" strokeLinejoin="round" />
          )}
          {effective === 'cheer' && (
            <g className="m-sparks">
              <path d="M24 70 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" className="m-spark" />
              <path d="M190 60 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" className="m-spark" />
            </g>
          )}
        </g>
      </svg>
      {effective === 'cheer' && <Confetti />}
    </motion.div>
  );
}
