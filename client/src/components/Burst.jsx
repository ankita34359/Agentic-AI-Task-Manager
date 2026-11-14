import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

/**
 * Comic action bursts: POW! NICE! OOPS!
 * burst('POW!', { x, y })  — x/y are viewport px (defaults to upper-middle of the screen).
 * Max 3 on screen at once. Animates transform + opacity only; reduced motion = plain fade.
 */
const BurstContext = createContext(() => {});
const COLORS = ['var(--y)', 'var(--pink)', 'var(--cyan)', 'var(--mint)', 'var(--orange)'];
const LIFETIME = 1050;
const MAX_ON_SCREEN = 3;

// 16-point starburst, computed once.
const STAR = Array.from({ length: 32 }, (_, i) => {
  const a = (i / 32) * Math.PI * 2 - Math.PI / 2;
  const outer = i % 2 === 0;
  return `${(70 + Math.cos(a) * (outer ? 66 : 45)).toFixed(1)},${(60 + Math.sin(a) * (outer ? 56 : 38)).toFixed(1)}`;
}).join(' ');

export function BurstProvider({ children }) {
  const [bursts, setBursts] = useState([]);
  const counter = useRef(0);
  const reduced = useReducedMotion();

  const burst = useCallback((text = 'POW!', opts = {}) => {
    const id = ++counter.current;
    const item = {
      id,
      text,
      x: opts.x || window.innerWidth / 2,
      y: opts.y || window.innerHeight * 0.38,
      color: opts.color || COLORS[id % COLORS.length],
      rot: (Math.random() - 0.5) * 24,
    };
    setBursts((list) => [...list.slice(-(MAX_ON_SCREEN - 1)), item]);
    setTimeout(() => setBursts((list) => list.filter((b) => b.id !== id)), LIFETIME);
  }, []);

  const value = useMemo(() => burst, [burst]);

  return (
    <BurstContext.Provider value={value}>
      {children}
      <div className="burst-layer" aria-hidden="true">
        <AnimatePresence>
          {bursts.map((b) => (
            <div key={b.id} className="burst-pos" style={{ left: b.x, top: b.y }}>
              <motion.div
                className="burst"
                initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.2, rotate: b.rot - 30 }}
                animate={{ opacity: 1, scale: 1, rotate: b.rot }}
                exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.3, y: -24 }}
                transition={{ type: 'spring', stiffness: 520, damping: 15 }}
              >
                <svg viewBox="0 0 140 120" width="140" height="120">
                  <polygon points={STAR} fill={b.color} stroke="var(--ink-fixed)" strokeWidth="4" strokeLinejoin="round" />
                  <text x="70" y="73" textAnchor="middle" className="burst__text">
                    {b.text}
                  </text>
                </svg>
              </motion.div>
            </div>
          ))}
        </AnimatePresence>
      </div>
    </BurstContext.Provider>
  );
}

export const useBurst = () => useContext(BurstContext);
