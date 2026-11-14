import { useEffect, useRef, useState } from 'react';
import { api } from '../../../lib/api.js';

/** Debounced Outcome Coach. Returns { result, loading }; result = { ready, flags[], suggestions[] } or null. */
export function useCoach(draft, delay = 450) {
  const [state, setState] = useState({ result: null, loading: false });
  const seq = useRef(0);
  const key = JSON.stringify(draft);

  useEffect(() => {
    if (!draft.title.trim()) {
      setState({ result: null, loading: false });
      return undefined;
    }
    const mine = ++seq.current;
    setState((s) => ({ ...s, loading: true }));
    const t = setTimeout(async () => {
      try {
        const result = await api.post('/api/coach', draft);
        if (mine === seq.current) setState({ result, loading: false });
      } catch {
        if (mine === seq.current) setState({ result: null, loading: false });
      }
    }, delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, delay]);

  return state;
}
