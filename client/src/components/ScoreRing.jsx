import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import CountUp from './CountUp.jsx';

/** Animated Value Score ring. The arc caps visually at 100; the number may exceed it. */
export default function ScoreRing({ value = 0, size = 180, stroke = 14, label = 'Value Score' }) {
  const gradientId = useId();
  const reduced = useReducedMotion();
  const radius = (size - stroke) / 2;
  const fraction = Math.max(0, Math.min(100, value)) / 100;

  return (
    <div className="score-ring" style={{ width: size, height: size, '--ring-size': `${size}px` }} role="img" aria-label={`${label}: ${Math.round(value)}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="55%" stopColor="var(--accent-2)" />
            <stop offset="100%" stopColor="var(--good)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--ring-track)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={{ pathLength: reduced ? fraction : 0 }}
          whileInView={{ pathLength: fraction }}
          viewport={{ once: true }}
          transition={reduced ? { duration: 0 } : { duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
        />
      </svg>
      <div className="score-ring__center">
        <strong>
          <CountUp to={value} />
        </strong>
        <span>{label}</span>
      </div>
    </div>
  );
}
