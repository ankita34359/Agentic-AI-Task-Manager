import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext.jsx';
import { MoonIcon, SunIcon } from './Icons.jsx';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const reduced = useReducedMotion();
  const next = theme === 'dark' ? 'light' : 'dark';

  return (
    <span className="sq-wrap sq-wrap--icon">
      <motion.button
        type="button"
        className="icon-btn"
        onClick={toggleTheme}
        aria-label={`Switch to ${next} theme`}
        title={`Switch to ${next} theme`}
        whileTap={reduced ? { scale: 0.94 } : { scaleX: 1.14, scaleY: 0.8 }}
        whileHover={reduced ? undefined : { rotate: [0, -8, 8, -4, 0], transition: { duration: 0.45 } }}
        transition={{ type: 'spring', stiffness: 420, damping: 9 }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={theme}
            style={{ display: 'grid' }}
            initial={reduced ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.5 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.5 }}
            transition={{ duration: 0.2 }}
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </span>
  );
}
