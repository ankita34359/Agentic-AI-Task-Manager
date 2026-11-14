import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, tokenStore } from '../lib/api.js';

/**
 * Session state: { status: 'loading' | 'authed' | 'anon', user, workspace }.
 * The token lives in localStorage; /api/me re-validates it on load (the server is the source of truth).
 *
 * login/signup return { user, commit }: the credentials are already verified, but nothing changes in the
 * app until commit() — so a page can play its celebration before the route guards redirect.
 */
const ANON = { status: 'anon', user: null, workspace: null };
const AuthContext = createContext({ ...ANON, login() {}, signupAdmin() {}, signupEmployee() {}, logout() {}, isLoggingOut: () => false, setWorkspace() {} });
const IN_APP = /^\/(admin|app)(\/|$)/;

export const homeFor = (user) => (user?.role === 'admin' ? '/admin/overview' : '/app/dashboard');
// minutes east of UTC (JS reports minutes *behind*, with the opposite sign)
const tzOffset = () => -new Date().getTimezoneOffset();

export function AuthProvider({ children }) {
  const [state, setState] = useState(() => (tokenStore.get() ? { status: 'loading', user: null, workspace: null } : ANON));

  // Logging out clears the session immediately, but the router applies the navigation to "/" a beat later
  // (as a deferred transition). In that gap the page being left would see "anonymous" and redirect to /login,
  // hijacking the logout. The guards consult this flag so they stay quiet until the URL has really moved.
  const loggingOut = useRef(false);
  const { pathname } = useLocation();
  useEffect(() => {
    if (loggingOut.current && !IN_APP.test(pathname)) loggingOut.current = false;
  }, [pathname]);

  useEffect(() => {
    if (!tokenStore.get()) return undefined;
    let alive = true;
    api
      .get('/api/me')
      .then((d) => alive && setState({ status: 'authed', user: d.user, workspace: d.workspace }))
      .catch(() => {
        if (!alive) return;
        tokenStore.clear();
        setState(ANON);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      tokenStore.clear();
      setState(ANON);
    };
    window.addEventListener('ol:unauthorized', onUnauthorized);
    return () => window.removeEventListener('ol:unauthorized', onUnauthorized);
  }, []);

  const start = useCallback(async (path, body) => {
    const data = await api.post(path, body);
    return {
      user: data.user,
      commit: () => {
        loggingOut.current = false;
        tokenStore.set(data.token);
        setState({ status: 'authed', user: data.user, workspace: data.workspace });
      },
    };
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login: (email, password) => start('/api/auth/login', { email, password }),
      signupAdmin: (f) => start('/api/auth/admin/signup', { ...f, tzOffset: tzOffset() }),
      signupEmployee: (f) => start('/api/auth/employee/signup', { ...f, tzOffset: tzOffset() }),
      logout: () => {
        loggingOut.current = true;
        tokenStore.clear();
        setState(ANON);
      },
      isLoggingOut: () => loggingOut.current,
      setWorkspace: (workspace) => setState((s) => ({ ...s, workspace })),
    }),
    [state, start],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
