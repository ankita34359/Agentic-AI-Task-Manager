import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * "Vibe" = how loud the world is.
 *  - ambient: 'lively' (landing, auth, empty states) | 'calm' (dashboard, board, tables → numbers stay readable)
 *  - tone:    'playful' | 'calm' (admin pages: still friendly, a bit less jokey)
 * Pages declare theirs with usePageVibe(); the choice is mirrored on <html data-ambient data-tone> for CSS.
 */
const DEFAULT = { ambient: 'lively', tone: 'playful' };
const VibeContext = createContext({ ...DEFAULT, setVibe: () => {} });

export function VibeProvider({ children }) {
  const [vibe, setVibeState] = useState(DEFAULT);

  const setVibe = useCallback((next) => {
    setVibeState((prev) => (prev.ambient === next.ambient && prev.tone === next.tone ? prev : next));
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-ambient', vibe.ambient);
    document.documentElement.setAttribute('data-tone', vibe.tone);
  }, [vibe]);

  const value = useMemo(() => ({ ...vibe, setVibe }), [vibe, setVibe]);
  return <VibeContext.Provider value={value}>{children}</VibeContext.Provider>;
}

export const useVibe = () => useContext(VibeContext);

/** Declare this page's vibe while it is mounted. */
export function usePageVibe(ambient = 'lively', tone = 'playful') {
  const { setVibe } = useVibe();
  useEffect(() => {
    setVibe({ ambient, tone });
    return () => setVibe(DEFAULT);
  }, [ambient, tone, setVibe]);
}
