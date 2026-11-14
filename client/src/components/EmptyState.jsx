import Mascot from './Mascot.jsx';
import StickerCard from './StickerCard.jsx';
import OneLiner from './OneLiner.jsx';
import SpeechBubble from './SpeechBubble.jsx';

/** Friendly empty state: Tally + a witty line + optional action. Reuse on every empty list/board. */
export default function EmptyState({ mood = 'shrug', kind = 'empty', title, children, action, size = 150 }) {
  return (
    <StickerCard className="empty" tilt={-0.6} hover={false}>
      <div className="empty__inner">
        <Mascot mood={mood} size={size} greet={false} autoSleep={false} />
        <div className="empty__copy">
          {title && <h2 className="empty__title">{title}</h2>}
          <SpeechBubble tail="left" className="empty__bubble">
            <OneLiner kind={kind} />
          </SpeechBubble>
          {children}
          {action && <div className="empty__action">{action}</div>}
        </div>
      </div>
    </StickerCard>
  );
}
