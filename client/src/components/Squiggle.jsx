import { motion, useReducedMotion } from 'framer-motion';

/** Hand-drawn wavy underline. Wipes in left→right using scaleX (transform only). */
export default function Squiggle({ children, color = 'var(--pink)', delay = 0.5 }) {
  const reduced = useReducedMotion();
  return (
    <span className="squig">
      {children}
      <motion.svg
        className="squig__line"
        viewBox="0 0 200 14"
        preserveAspectRatio="none"
        aria-hidden="true"
        initial={reduced ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
        style={{ originX: 0 }}
      >
        <path
          d="M3 8 Q 14 0 25 8 T 47 8 T 69 8 T 91 8 T 113 8 T 135 8 T 157 8 T 179 8 T 197 6"
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </motion.svg>
    </span>
  );
}
