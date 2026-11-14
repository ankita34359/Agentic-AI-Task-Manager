import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { subscribePointer } from '../lib/pointer.js';
import { useVibe } from '../context/VibeContext.jsx';

const MAX_POINTS = 14; // hard cap
const LIFE = 650; // ms
const MIN_STEP = 16; // px between sparkles
const COLORS = ['#ffd23f', '#ff6fa8', '#35c8f5', '#4ee3a5'];

/**
 * Tiny sparkle trail behind the cursor. Fine pointers only, off for reduced motion and on calm pages.
 * The rAF loop only runs while sparkles are alive, and stops in hidden tabs.
 */
export default function CursorTrail() {
  const canvasRef = useRef(null);
  const reduced = useReducedMotion();
  const { ambient } = useVibe();
  const [finePointer] = useState(() => window.matchMedia('(pointer: fine)').matches);
  const enabled = !reduced && ambient === 'lively' && finePointer;

  useEffect(() => {
    if (!enabled) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let dpr = 1;
    let raf = 0;
    let last = null;
    let n = 0;
    const points = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (now) => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = points.length - 1; i >= 0; i--) {
        const p = points[i];
        const t = (now - p.t) / LIFE;
        if (t >= 1) {
          points.splice(i, 1);
          continue;
        }
        const s = p.size * (1 - t);
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        // 4-point sparkle
        ctx.moveTo(p.x, p.y - s);
        ctx.quadraticCurveTo(p.x, p.y, p.x + s, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + s);
        ctx.quadraticCurveTo(p.x, p.y, p.x - s, p.y);
        ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - s);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = points.length && !document.hidden ? requestAnimationFrame(draw) : 0;
    };

    const unsubscribe = subscribePointer((x, y) => {
      if (last && Math.hypot(x - last.x, y - last.y) < MIN_STEP) return;
      last = { x, y };
      points.push({ x, y, t: performance.now(), size: 7 + Math.random() * 5, color: COLORS[n++ % COLORS.length] });
      if (points.length > MAX_POINTS) points.shift();
      if (!raf && !document.hidden) raf = requestAnimationFrame(draw);
    });

    resize();
    window.addEventListener('resize', resize);
    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <canvas ref={canvasRef} className="cursor-trail" aria-hidden="true" />;
}
