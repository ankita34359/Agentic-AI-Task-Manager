import { useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';

const COLORS = ['var(--y)', 'var(--pink)', 'var(--cyan)', 'var(--mint)', 'var(--orange)', 'var(--purple)'];

/**
 * One-shot confetti burst (capped at 24 pieces). Mount it to fire; unmount/remount to fire again.
 * Pure CSS transform + opacity. Renders nothing for reduced-motion users.
 */
export default function Confetti({ count = 22 }) {
  const reduced = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: Math.min(count, 24) }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 70 + Math.random() * 90;
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist - 40,
          rot: (Math.random() - 0.5) * 720,
          color: COLORS[i % COLORS.length],
          delay: Math.random() * 0.08,
          w: 6 + Math.random() * 6,
          h: 9 + Math.random() * 7,
          round: i % 3 === 0,
        };
      }),
    [count],
  );
  if (reduced) return null;
  return (
    <span className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          className="confetti__p"
          style={{
            '--dx': `${p.dx}px`,
            '--dy': `${p.dy}px`,
            '--rot': `${p.rot}deg`,
            width: p.w,
            height: p.round ? p.w : p.h,
            borderRadius: p.round ? '50%' : 2,
            background: p.color,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </span>
  );
}
