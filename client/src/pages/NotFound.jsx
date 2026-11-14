import { Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition.jsx';

export default function NotFound() {
  return (
    <PageTransition className="page stub">
      <div className="glass stub__card">
        <span className="eyebrow">404</span>
        <h1>That page isn’t on the board</h1>
        <p>The link may be old, or the page hasn’t shipped yet.</p>
        <div className="stub__actions">
          <Link to="/" className="btn btn-primary btn-sm">
            Back to home
          </Link>
        </div>
      </div>
    </PageTransition>
  );
}
