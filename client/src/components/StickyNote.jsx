import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** Dust puff shown when a note is dropped. Capped at 6 specks; transform + opacity only. */
export function DustPuff() {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <span className="dust" aria-hidden="true">
      {[-34, -18, -4, 10, 24, 38].map((dx, i) => (
        <span key={i} className="dust__p" style={{ '--dx': `${dx}px`, '--s': 0.8 + (i % 3) * 0.35, animationDelay: `${i * 18}ms` }} />
      ))}
    </span>
  );
}

/**
 * Kanban card as a sticky note: slight tilt, squashes when picked up (`dragging`), dust puff on drop.
 * color: yellow | pink | cyan | mint | orange
 * Controlled by the parent (dnd-kit's isDragging later); the landing page demos it with pointer events.
 */
export default function StickyNote({ color = 'yellow', tilt = -2, dragging = false, tape = true, className = '', children, ...rest }) {
  const reduced = useReducedMotion();
  const wasDragging = useRef(false);
  const [puff, setPuff] = useState(0);

  useEffect(() => {
    if (wasDragging.current && !dragging) setPuff((n) => n + 1);
    wasDragging.current = dragging;
  }, [dragging]);

  return (
    <motion.div
      className={`note note--${color}${dragging ? ' note--lifted' : ''} ${className}`}
      animate={
        dragging && !reduced
          ? { scaleX: 1.06, scaleY: 0.94, y: -8, rotate: tilt + 3 }
          : { scaleX: 1, scaleY: 1, y: 0, rotate: reduced ? 0 : tilt }
      }
      transition={{ type: 'spring', stiffness: 520, damping: dragging ? 18 : 9 }}
      {...rest}
    >
      {tape && <span className="note__tape" aria-hidden="true" />}
      {children}
      {puff > 0 && <DustPuff key={puff} />}
    </motion.div>
  );
}
