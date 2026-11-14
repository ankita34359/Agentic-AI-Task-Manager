import PageTransition from '../components/PageTransition.jsx';
import EmptyState from '../components/EmptyState.jsx';
import SquishyButton from '../components/SquishyButton.jsx';
import { usePageVibe } from '../context/VibeContext.jsx';

export default function NotFound() {
  usePageVibe('lively');
  return (
    <PageTransition className="page stub">
      <div className="stub__wrap stub__wrap--narrow">
        <EmptyState
          mood="shrug"
          kind="notfound"
          title="404"
          action={
            <SquishyButton to="/" size="sm" burst="WHOOSH!">
              Back to home
            </SquishyButton>
          }
        />
      </div>
    </PageTransition>
  );
}
