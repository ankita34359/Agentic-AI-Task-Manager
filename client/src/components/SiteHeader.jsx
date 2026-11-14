import { Link } from 'react-router-dom';
import { LogoMark } from './Icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="brand" aria-label="Outcome Ledger home">
          <LogoMark />
          <span>Outcome Ledger</span>
        </Link>
        <div className="header-actions">
          <Link to="/login" className="btn btn-ghost btn-sm">
            Log in
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
