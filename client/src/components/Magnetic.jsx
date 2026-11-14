import { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

/**
 * Wrap a button/link so it is gently pulled toward the cursor.
 * The static outer span owns the pointer handlers so the hit area never moves (no jitter).
 * Disabled for touch pointers and reduced motion.
 */
export default function Magnetic({ children, strength = 0.32, className = '' }) {
  const areaRef = useRef(null);
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 230, damping: 17, mass: 0.35 });
  const sy = useSpring(y, { stiffness: 230, damping: 17, mass: 0.35 });

  function onPointerMove(e) {
    if (reduced || e.pointerType === 'touch') return;
    const rect = areaRef.current.getBoundingClientRect();
    x.set((e.clientX - (rect.left + rect.width / 2)) * strength);
    y.set((e.clientY - (rect.top + rect.height / 2)) * strength);
  }
  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <span ref={areaRef} className={`magnetic-area ${className}`} onPointerMove={onPointerMove} onPointerLeave={reset}>
      <motion.span className="magnetic-inner" style={{ x: sx, y: sy }}>
        {children}
      </motion.span>
    </span>
  );
}
