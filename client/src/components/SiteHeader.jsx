import { Link } from 'react-router-dom';
import { LogoMark } from './Icons.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import SquishyButton from './SquishyButton.jsx';

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="brand" aria-label="Outcome Ledger home">
          <LogoMark />
          <span>Outcome Ledger</span>
        </Link>
        <div className="header-actions">
          <SquishyButton to="/login" variant="ghost" size="sm" burst="HI!">
            Log in
          </SquishyButton>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
