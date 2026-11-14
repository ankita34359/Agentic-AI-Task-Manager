import { motion, useReducedMotion } from 'framer-motion';

/**
 * Wraps a routed page. The torn-paper sheet (TornTransition) does the heavy lifting between routes;
 * this just fades/settles the new page in underneath it (opacity only for reduced motion).
 */
export default function PageTransition({ children, className = 'page' }) {
  const reduced = useReducedMotion();
  return (
    <motion.main
      id="main"
      tabIndex={-1}
      className={className}
      initial={{ opacity: 0, y: reduced ? 0 : 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.main>
  );
}
