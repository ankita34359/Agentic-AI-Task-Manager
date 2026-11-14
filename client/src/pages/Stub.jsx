import { Link } from 'react-router-dom';
import PageTransition from '../components/PageTransition.jsx';
import { useToast } from '../components/Toasts.jsx';

/** Placeholder for routes that arrive in a later milestone. Doubles as a toast demo. */
export default function Stub({ title, blurb, milestone = 2 }) {
  const toast = useToast();
  return (
    <PageTransition className="page stub">
      <div className="glass stub__card">
        <span className="eyebrow">Arrives in milestone {milestone}</span>
        <h1>{title}</h1>
        <p>{blurb}</p>
        <div className="stub__actions">
          <Link to="/" className="btn btn-primary btn-sm">
            Back to home
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => toast.success('Toasts work', 'This is how confirmations will look.')}>
            Test a toast
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => toast.error('Something went wrong', 'Errors stay a little longer.')}>
            Test an error
          </button>
        </div>
      </div>
    </PageTransition>
  );
}
