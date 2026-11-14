import PageTransition from '../components/PageTransition.jsx';
import EmptyState from '../components/EmptyState.jsx';

/** Placeholder for a signed-in page that arrives in a later milestone. */
export default function ComingSoon({ title, milestone, children }) {
  return (
    <PageTransition>
      <div className="container page-body">
        <h1 className="display h2 page-title">{title}</h1>
        <EmptyState mood="think" kind="empty" title={`Arrives in milestone ${milestone}`}>
          {children && <p className="empty__note">{children}</p>}
        </EmptyState>
      </div>
    </PageTransition>
  );
}
