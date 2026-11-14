// One shared, rAF-throttled pointermove listener for everything that follows the cursor
// (mascot eyes, cursor trail). Attached only while something is subscribed.
const subscribers = new Set();
let raf = 0;
let attached = false;
const last = { x: 0, y: 0 };

function onMove(e) {
  last.x = e.clientX;
  last.y = e.clientY;
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    subscribers.forEach((fn) => fn(last.x, last.y));
  });
}

export function subscribePointer(fn) {
  subscribers.add(fn);
  if (!attached) {
    window.addEventListener('pointermove', onMove, { passive: true });
    attached = true;
  }
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size && attached) {
      window.removeEventListener('pointermove', onMove);
      attached = false;
    }
  };
}
