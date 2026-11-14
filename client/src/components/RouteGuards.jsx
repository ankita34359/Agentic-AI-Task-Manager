import { Navigate } from 'react-router-dom';
import { homeFor, useAuth } from '../context/AuthContext.jsx';
import { useRealPathname } from './TornTransition.jsx';
import PageTransition from './PageTransition.jsx';
import Mascot from './Mascot.jsx';
import OneLiner from './OneLiner.jsx';

/**
 * Client-side guards. These are for navigation/UX only — every API route re-checks the token and role on the server.
 */
function AuthLoading() {
  return (
    <PageTransition className="page stub">
      <div className="stub__mascot">
        <Mascot mood="think" size={170} greet={false} autoSleep={false} />
        <p className="loading-line" role="status">
          <OneLiner kind="loading" interval={1800} />
        </p>
      </div>
    </PageTransition>
  );
}

/**
 * Only for signed-in users with the given role. Others go to login (anon) or to their own home (wrong role).
 *
 * During a page transition the OLD page stays mounted until the torn sheet covers it. If the user just
 * logged out and is navigating to "/", that stale page must not fire its own redirect and hijack the
 * navigation — so when the real URL is already outside this area, it renders nothing and stays quiet.
 */
export function RequireRole({ role, children }) {
  const { status, user, isLoggingOut } = useAuth();
  const realPath = useRealPathname(); // NOT useLocation(): inside a transition that is the old page's location
  const area = role === 'admin' ? '/admin' : '/app';
  const leaving = !(realPath === area || realPath.startsWith(`${area}/`));
  if (status === 'loading') return <AuthLoading />;
  if (status !== 'authed') return leaving || isLoggingOut() ? null : <Navigate to="/login" replace state={{ from: realPath }} />;
  if (user.role !== role) return leaving ? null : <Navigate to={homeFor(user)} replace />;
  return children;
}

/** Login / sign-up pages: signed-in users are sent to their own home instead. */
export function PublicOnly({ children }) {
  const { status, user } = useAuth();
  if (status === 'loading') return <AuthLoading />;
  if (status === 'authed') return <Navigate to={homeFor(user)} replace />;
  return children;
}
