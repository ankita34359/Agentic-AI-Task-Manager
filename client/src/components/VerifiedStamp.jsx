import { motion, useReducedMotion } from 'framer-motion';

/** "Verified" stamp that slams onto the card. Reduced motion: simple fade, no rotation/scale. */
export default function VerifiedStamp({ delay = 0.8, tilt = -9, label = 'Verified' }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="stamp"
      role="img"
      aria-label={label}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 2.4, rotate: tilt - 14 }}
      whileInView={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: tilt }}
      viewport={{ once: true }}
      transition={reduced ? { duration: 0.2, delay } : { type: 'spring', stiffness: 420, damping: 16, mass: 0.7, delay }}
      style={reduced ? { rotate: tilt } : undefined}
    >
      {label}
    </motion.div>
  );
}
