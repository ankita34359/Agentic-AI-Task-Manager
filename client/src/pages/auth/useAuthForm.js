import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBurst } from '../../components/Burst.jsx';
import { homeFor } from '../../context/AuthContext.jsx';
import { errorMessage } from '../../lib/errors.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Shared submit flow for login / sign-up pages:
 *   think (Tally ponders) → success: cheer + burst, then sign in and go home
 *                         → failure: shrug + OOPS!, show the server's per-field errors
 * `action` must resolve to { user, commit } (see AuthContext) — nothing changes in the app until commit().
 */
export function useAuthForm(successBurst = 'YAY!') {
  const navigate = useNavigate();
  const fire = useBurst();
  const [busy, setBusy] = useState(false);
  const [mood, setMood] = useState('idle');
  const [formError, setFormError] = useState('');
  const [fields, setFields] = useState({});
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function run(e, action) {
    e.preventDefault();
    if (busy) return;
    clearTimeout(timer.current);
    setBusy(true);
    setFormError('');
    setFields({});
    setMood('think');
    try {
      const { user, commit } = await action();
      setMood('cheer');
      fire(successBurst);
      await sleep(850);
      commit();
      navigate(homeFor(user), { replace: true });
    } catch (err) {
      setFields(err.fields || {});
      setFormError(errorMessage(err));
      setMood('shrug');
      fire('OOPS!');
      timer.current = setTimeout(() => setMood('idle'), 3500);
    } finally {
      setBusy(false);
    }
  }

  return { busy, mood, formError, fields, run };
}
