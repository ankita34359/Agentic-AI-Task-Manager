import PageTransition from '../../components/PageTransition.jsx';
import Mascot from '../../components/Mascot.jsx';
import StickerCard from '../../components/StickerCard.jsx';
import SpeechBubble from '../../components/SpeechBubble.jsx';
import OneLiner from '../../components/OneLiner.jsx';
import { usePageVibe } from '../../context/VibeContext.jsx';

/** Shared layout for login and both sign-up pages: Tally on the left reacting to the form, the card on the right. */
export default function AuthShell({ title, blurb, mood = 'idle', children, footer }) {
  usePageVibe('lively');
  return (
    <PageTransition className="page stub">
      <div className="stub__wrap">
        <div className="stub__mascot">
          <SpeechBubble tail="bottom-left" tilt={-2}>
            <OneLiner kind="mascot" interval={5200} />
          </SpeechBubble>
          <Mascot size={200} mood={mood} />
        </div>
        <StickerCard color="paper" tilt={-0.6} hover={false} className="stub__card auth-card">
          <div className="stub__body">
            <h1 className="display h2">{title}</h1>
            <p className="auth-blurb">{blurb}</p>
            {children}
            {footer && <div className="auth-footer">{footer}</div>}
          </div>
        </StickerCard>
      </div>
    </PageTransition>
  );
}
