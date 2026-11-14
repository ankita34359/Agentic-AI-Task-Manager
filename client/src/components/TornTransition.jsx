import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { pickLine } from '../lib/lines.js';

/**
 * Torn-paper route transition.
 * A sheet of paper with ripped (jagged SVG-style clip-path) edges sweeps across the screen; the
 * route swaps while it fully covers the page, then it rips away the other side. Only the sheet's
 * transform animates — the jagged clip-paths are static. Reduced motion: instant swap (the page
 * itself fades in via PageTransition).
 *
 * Usage: <TornTransition>{(location) => <Routes location={location}>…</Routes>}</TornTransition>
 */
function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Jagged polygon down both long edges; `inset` pulls it inward so layers nest into an outline. */
function tornPolygon(seed, amp, inset, steps = 30) {
  const r = rng(seed);
  const left = [];
  const right = [];
  for (let i = 0; i <= steps; i++) {
    const y = ((i / steps) * 100).toFixed(2);
    left.push(`${(inset + r() * amp).toFixed(2)}% ${y}%`);
    right.push(`${(100 - inset - r() * amp).toFixed(2)}% ${y}%`);
  }
  return `polygon(${[...left, ...right.reverse()].join(',')})`;
}

const INK = tornPolygon(7, 2.4, 0);
const FIBER = tornPolygon(7, 2.4, 0.5);
const PAPER = tornPolygon(7, 2.4, 1.1);

const COVER = { duration: 0.36, ease: [0.65, 0, 0.35, 1] };
const REVEAL = { duration: 0.42, ease: [0.65, 0, 0.35, 1], delay: 0.1 };
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

export default function TornTransition({ children }) {
  const location = useLocation();
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(location);
  const [active, setActive] = useState(false);
  const [word, setWord] = useState('Flip!');
  const x = useMotionValue('-100%');
  const latest = useRef(location);
  const mounted = useRef(true);
  latest.current = location;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (location.key === shown.key) return;
    if (reduced) {
      setShown(location);
      window.scrollTo(0, 0);
      return;
    }
    if (active) return; // the running sweep will pick up the latest location
    setWord(pickLine('transition'));
    setActive(true);
    (async () => {
      x.jump('-100%');
      await animate(x, '0%', COVER);
      if (!mounted.current) return;
      setShown(latest.current);
      window.scrollTo(0, 0);
      await nextFrame();
      await animate(x, '100%', REVEAL);
      if (mounted.current) setActive(false);
    })();
  }, [location, shown.key, active, reduced, x]);

  return (
    <>
      {children(shown)}
      {active && (
        <motion.div className="torn" style={{ x }} aria-hidden="true">
          <div className="torn__layer torn__ink" style={{ clipPath: INK }} />
          <div className="torn__layer torn__fiber" style={{ clipPath: FIBER }} />
          <div className="torn__layer torn__paper" style={{ clipPath: PAPER }}>
            <span className="torn__word">{word}</span>
          </div>
        </motion.div>
      )}
    </>
  );
}
