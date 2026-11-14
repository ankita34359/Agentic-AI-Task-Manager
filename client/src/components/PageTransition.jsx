import { motion, useReducedMotion } from 'framer-motion';

/** Wraps a routed page: fade + slight rise in, fade out. Reduced motion: opacity only. */
export default function PageTransition({ children, className = 'page' }) {
  const reduced = useReducedMotion();
  return (
    <motion.main
      id="main"
      tabIndex={-1}
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduced ? 0 : -10 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.main>
  );
}
