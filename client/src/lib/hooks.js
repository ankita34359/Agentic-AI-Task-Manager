import { useEffect, useState } from 'react';

/** Mirrors document.hidden onto <html data-hidden> so CSS can pause every animation in background tabs. */
export function useHiddenFlag() {
  useEffect(() => {
    const set = () => document.documentElement.setAttribute('data-hidden', String(document.hidden));
    set();
    document.addEventListener('visibilitychange', set);
    return () => document.removeEventListener('visibilitychange', set);
  }, []);
}

/** True while the tab is hidden (for JS timers / rAF loops). */
export function useIsHidden() {
  const [hidden, setHidden] = useState(typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return hidden;
}

/** True after `ms` without pointer/keyboard/scroll/touch activity. */
export function useIdle(ms, enabled = true) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      return undefined;
    }
    let timer;
    let lastAct = 0;
    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setIdle(true), ms);
    };
    const onActivity = () => {
      const now = Date.now();
      if (now - lastAct < 300) return;
      lastAct = now;
      setIdle(false);
      arm();
    };
    const events = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    arm();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [ms, enabled]);
  return idle;
}
