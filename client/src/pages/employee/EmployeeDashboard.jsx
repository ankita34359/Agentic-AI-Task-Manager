import PageTransition from '../../components/PageTransition.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import SquishyButton from '../../components/SquishyButton.jsx';
import OneLiner from '../../components/OneLiner.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function EmployeeDashboard() {
  const { user, workspace } = useAuth();
  return (
    <PageTransition>
      <div className="container page-body">
        <header className="page-head">
          <h1 className="display h2 page-title">Hi, {user.name.split(' ')[0]}!</h1>
          <p className="page-sub">
            {workspace?.name} · <OneLiner kind="tagline" interval={9000} />
          </p>
        </header>
        <EmptyState
          mood="idle"
          kind="empty"
          title="No outcomes yet"
          action={
            <SquishyButton to="/app/board" size="sm" burst="POW!">
              Go to My Board
            </SquishyButton>
          }
        >
          <p className="empty__note">Your Value Score ring, streak and 7-day trend will live here (milestone 6). Outcomes arrive in milestone 3.</p>
        </EmptyState>
      </div>
    </PageTransition>
  );
}
