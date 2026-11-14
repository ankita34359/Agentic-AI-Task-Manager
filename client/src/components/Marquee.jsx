import { useState } from 'react';
import { pickMany } from '../lib/lines.js';

/** Scrolling strip of one-liners. Pauses on hover and in background tabs; static scroller under reduced motion. */
export default function Marquee({ count = 9, kind = 'marquee', tone = 'playful', seconds = 60, className = '' }) {
  const [items] = useState(() => pickMany(kind, count, tone));
  const row = (hidden) =>
    items.map((text, i) => (
      <span className="marquee__item" key={`${hidden ? 'b' : 'a'}${i}`} aria-hidden={hidden || undefined}>
        {text}
        <span className="marquee__star" aria-hidden="true">
          ✦
        </span>
      </span>
    ));
  return (
    <div className="marquee-clip">
      <div className={`marquee ${className}`} role="region" aria-label="Words of wisdom">
        <div className="marquee__track" style={{ '--dur': `${seconds}s` }}>
          {row(false)}
          {row(true)}
        </div>
      </div>
    </div>
  );
}
