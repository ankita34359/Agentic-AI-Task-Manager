import { Link, useNavigate } from 'react-router-dom';
import { LogoMark } from './Icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import SquishyButton from './SquishyButton.jsx';
import { homeFor, useAuth } from '../context/AuthContext.jsx';

export default function SiteHeader() {
  const { status, user, logout } = useAuth();
  const navigate = useNavigate();
  const authed = status === 'authed';

  return (
    <header className="site-header">
      <div className="container">
        <Link to={authed ? homeFor(user) : '/'} className="brand" aria-label="Outcome Ledger home">
          <LogoMark />
          <span>Outcome Ledger</span>
        </Link>
        <div className="header-actions">
          {authed ? (
            <>
              <span className="who" title={user.email}>
                <span className="avatar avatar--sm" aria-hidden="true">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="who__name">{user.name.split(' ')[0]}</span>
              </span>
              <SquishyButton
                variant="ghost"
                size="sm"
                burst="BYE!"
                onClick={() => {
                  logout();
                  navigate('/');
                }}
              >
                Log out
              </SquishyButton>
            </>
          ) : (
            <SquishyButton to="/login" variant="ghost" size="sm" burst="HI!">
              Log in
            </SquishyButton>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
