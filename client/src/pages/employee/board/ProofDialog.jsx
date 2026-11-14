import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import Mascot from '../../../components/Mascot.jsx';
import SquishyButton from '../../../components/SquishyButton.jsx';
import StickerCard from '../../../components/StickerCard.jsx';

/**
 * Opens when a note is dropped on Done (or moved there from the menu).
 * The real proof form (link / note / screenshot + the validator) arrives in milestone 5; until then this
 * shows what will be asked for, so the flow already feels right and nothing is silently marked done.
 */
export default function ProofDialog({ task, onClose }) {
  const reduced = useReducedMotion();
  const closeRef = useRef(null);
  const opener = useRef(typeof document !== 'undefined' ? document.activeElement : null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const back = opener.current;
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      back?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="proof-title"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 30, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 22 }}
      >
        <StickerCard color="paper" hover={false} tilt={-0.5}>
          <div className="dialog__body">
            <Mascot mood="think" size={120} greet={false} autoSleep={false} interactive={false} />
            <div>
              <h2 id="proof-title" className="card-title">
                Proof, please
              </h2>
              <p className="dialog__task">“{task.title}”</p>
              <p>
                Done has to be earned. Soon you will attach a link, a note or a screenshot here, and the Proof Validator will check it against your criteria.
              </p>
              <p className="dialog__soon">
                <strong>Milestone 5.</strong> For now the note stays in <b>In Progress</b>.
              </p>
              <h3 className="dialog__sub">You promised</h3>
              <ul className="dialog__list">
                {task.criteria.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p className="dialog__proof">
                <b>Your plan:</b> {task.proofPlan}
              </p>
              <div className="btn-row">
                <SquishyButton ref={closeRef} onClick={onClose} burst="OK!">
                  Got it
                </SquishyButton>
              </div>
            </div>
          </div>
        </StickerCard>
      </motion.div>
    </div>
  );
}
