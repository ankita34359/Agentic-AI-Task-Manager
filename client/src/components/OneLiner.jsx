import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { pickLine } from '../lib/lines.js';
import { useIsHidden } from '../lib/hooks.js';
import { useVibe } from '../context/VibeContext.jsx';

/** A single random line for this mount (stable across re-renders). Use for toasts, empty states, errors… */
export function useLine(kind, toneOverride) {
  const { tone: vibeTone } = useVibe();
  const tone = toneOverride || vibeTone;
  const ref = useRef(null);
  if (ref.current === null) ref.current = pickLine(kind, tone);
  return ref.current;
}

/**
 * Witty microcopy. With `interval` it rotates (crossfade, never the same line twice in a row),
 * pausing while the tab is hidden. Reduced motion: picks one line and keeps it.
 * Admin pages automatically get the calmer tone via the vibe context.
 */
export default function OneLiner({ kind = 'tagline', interval = 0, tone: toneOverride, as: Tag = 'span', className = '' }) {
  const { tone: vibeTone } = useVibe();
  const tone = toneOverride || vibeTone;
  const reduced = useReducedMotion();
  const hidden = useIsHidden();
  const [text, setText] = useState(() => pickLine(kind, tone));

  useEffect(() => {
    setText((prev) => pickLine(kind, tone, prev));
  }, [kind, tone]);

  useEffect(() => {
    if (!interval || reduced || hidden) return undefined;
    const id = setInterval(() => setText((prev) => pickLine(kind, tone, prev)), interval);
    return () => clearInterval(id);
  }, [interval, reduced, hidden, kind, tone]);

  return (
    <Tag className={`oneliner ${className}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={text}
          className="oneliner__text"
          initial={reduced ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduced ? undefined : { opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
        >
          {text}
        </motion.span>
      </AnimatePresence>
    </Tag>
  );
}
