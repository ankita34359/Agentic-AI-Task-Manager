import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/** Smooth Catmull-Rom → cubic Bézier path through the points. */
function smoothPath(pts) {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Animated trend line: line draws in, area fades up, points pop in sequence. */
export default function TrendLine({ data, labels, width = 320, height = 110, max, ariaLabel = 'Trend' }) {
  const gradientId = useId();
  const reduced = useReducedMotion();
  const padX = 12;
  const padTop = 12;
  const padBottom = labels ? 22 : 12;
  const top = max ?? Math.max(1, ...data);
  const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;
  const plotH = height - padTop - padBottom;
  const pts = data.map((v, i) => ({ x: +(padX + i * stepX).toFixed(1), y: +(padTop + plotH - (v / top) * plotH).toFixed(1) }));
  const line = smoothPath(pts);
  const area = `${line} L${pts.at(-1).x},${height - padBottom} L${pts[0].x},${height - padBottom} Z`;
  const t = (delay, duration = 1) => (reduced ? { duration: 0 } : { duration, delay, ease: [0.22, 1, 0.36, 1] });

  return (
    <svg className="trend" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${ariaLabel}: ${data.join(', ')}`}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path d={area} fill={`url(#${gradientId})`} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={t(0.6, 0.9)} />
      <motion.path
        d={line}
        fill="none"
        stroke="var(--accent-2)"
        strokeWidth="2.5"
        strokeLinecap="round"
        initial={{ pathLength: reduced ? 1 : 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={t(0.15, 1.4)}
      />
      {pts.map((p, i) => (
        <motion.circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={i === pts.length - 1 ? 4.5 : 3}
          fill={i === pts.length - 1 ? 'var(--accent)' : 'var(--bg)'}
          stroke="var(--accent-2)"
          strokeWidth="2"
          initial={{ opacity: 0, scale: reduced ? 1 : 0 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={t(0.5 + i * 0.12, 0.4)}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      ))}
      {labels &&
        pts.map((p, i) => (
          <text key={`l${i}`} x={p.x} y={height - 6} textAnchor="middle">
            {labels[i]}
          </text>
        ))}
    </svg>
  );
}
