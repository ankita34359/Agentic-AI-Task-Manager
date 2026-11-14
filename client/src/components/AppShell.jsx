import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { usePageVibe } from '../context/VibeContext.jsx';

/**
 * Layout for a signed-in area (admin or employee): workspace label + tab bar + the routed page.
 * Both areas are data-heavy, so the background goes 'calm'; admin also gets the calmer tone of voice.
 */
export default function AppShell({ nav, roleLabel, tone = 'playful' }) {
  const { workspace } = useAuth();
  usePageVibe('calm', tone);
  return (
    <div className="shell">
      <div className="container shell__bar">
        <div className="shell__who">
          <span className="chip chip--role">{roleLabel}</span>
          <strong className="shell__ws">{workspace?.name}</strong>
        </div>
        <nav className="tabs" aria-label={`${roleLabel} sections`}>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `tab${isActive ? ' tab--active' : ''}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
