import PageTransition from '../components/PageTransition.jsx';
import Mascot from '../components/Mascot.jsx';
import SquishyButton from '../components/SquishyButton.jsx';
import StickerCard from '../components/StickerCard.jsx';
import SpeechBubble from '../components/SpeechBubble.jsx';
import OneLiner from '../components/OneLiner.jsx';
import { useToast } from '../components/Toasts.jsx';
import { usePageVibe } from '../context/VibeContext.jsx';

/** Placeholder for routes that arrive in a later milestone. Doubles as a toast + burst demo. */
export default function Stub({ title, blurb, milestone = 2 }) {
  usePageVibe('lively');
  const toast = useToast();
  return (
    <PageTransition className="page stub">
      <div className="stub__wrap">
        <div className="stub__mascot">
          <SpeechBubble tail="bottom-left" tilt={-2}>
            <OneLiner kind="mascot" interval={5200} />
          </SpeechBubble>
          <Mascot size={210} />
        </div>
        <StickerCard color="paper" tilt={-1} hover={false} className="stub__card">
          <div className="stub__body">
            <span className="eyebrow">Arrives in milestone {milestone}</span>
            <h1 className="display h2">{title}</h1>
            <p>{blurb}</p>
            <div className="stub__actions">
              <SquishyButton to="/" size="sm" burst="WHOOSH!">
                Back to home
              </SquishyButton>
              <SquishyButton variant="mint" size="sm" burst="NICE!" onClick={() => toast.success('Toasts work')}>
                Test a toast
              </SquishyButton>
              <SquishyButton variant="pink" size="sm" burst="OOPS!" onClick={() => toast.error('Something went wrong')}>
                Test an error
              </SquishyButton>
            </div>
          </div>
        </StickerCard>
      </div>
    </PageTransition>
  );
}
