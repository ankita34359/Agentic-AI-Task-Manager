import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { useBurst } from './Burst.jsx';

/**
 * Comic button with squash-and-stretch.
 *  - hover: little wobble
 *  - press: squishes wide + flat, springs back with a bounce, hard shadow stays put
 *  - `burst="POW!"` fires a comic burst at the click point
 * Renders a router <Link> (`to`), an <a> (`href`) or a <button>.
 * variant: primary (yellow) | pink | cyan | mint | ghost      size: sm | md | lg      block: full width
 */
export default function SquishyButton({
  to,
  href,
  variant = 'primary',
  size = 'md',
  block = false,
  burst,
  className = '',
  children,
  onClick,
  type = 'button',
  ...rest
}) {
  const reduced = useReducedMotion();
  const fire = useBurst();

  const handleClick = (e) => {
    if (burst) {
      const r = e.currentTarget.getBoundingClientRect();
      fire(burst, { x: e.clientX || r.left + r.width / 2, y: e.clientY || r.top });
    }
    onClick?.(e);
  };

  const Tag = to ? Link : href ? 'a' : 'button';
  const tagProps = to ? { to } : href ? { href } : { type };

  return (
    <motion.span
      className={`sq-wrap${block ? ' sq-wrap--block' : ''}`}
      whileHover={reduced ? undefined : { rotate: [0, -2.5, 2.5, -1.5, 0], transition: { duration: 0.45 } }}
      whileTap={reduced ? { scale: 0.97 } : { scaleX: 1.1, scaleY: 0.82, transition: { type: 'spring', stiffness: 900, damping: 16 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 9 }}
    >
      <Tag className={`sbtn sbtn--${variant} sbtn--${size} ${className}`} onClick={handleClick} {...tagProps} {...rest}>
        {children}
      </Tag>
    </motion.span>
  );
}
