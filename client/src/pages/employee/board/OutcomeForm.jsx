import { useId, useState } from 'react';
import Field from '../../../components/Field.jsx';
import SquishyButton from '../../../components/SquishyButton.jsx';
import StickerCard from '../../../components/StickerCard.jsx';
import SpeechBubble from '../../../components/SpeechBubble.jsx';
import Mascot from '../../../components/Mascot.jsx';
import { useCoach } from './useCoach.js';
import { todayLocal } from './columns.js';

const IMPACT_LABELS = ['', 'Nice to have', 'Helpful', 'Solid', 'Big win', 'Needle-mover'];

function TextArea({ label, error, hint, ...props }) {
  const id = useId();
  const msg = `${id}-msg`;
  const note = error ? { kind: 'error', text: error } : hint ? { kind: 'hint', text: hint } : null;
  return (
    <div className={`field${error ? ' field--error' : ''}`}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} className="input input--area" aria-invalid={error ? true : undefined} aria-describedby={note ? msg : undefined} {...props} />
      {note && (
        <p id={msg} className={`field__msg field__msg--${note.kind}`} role={note.kind === 'error' ? 'alert' : undefined}>
          {note.text}
        </p>
      )}
    </div>
  );
}

/** New-outcome form with the live Outcome Coach beside it. `onSubmit` resolves, or throws an ApiError (fields are shown inline). */
export default function OutcomeForm({ onSubmit, onCancel, disabled }) {
  const [f, setF] = useState({ title: '', details: '', deadline: todayLocal(), impact: 3, criteria: [''], proofPlan: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const filled = f.criteria.map((c) => c.trim()).filter(Boolean);

  const coach = useCoach({ title: f.title, details: f.details, criteria: filled, proofPlan: f.proofPlan });
  const flags = coach.result?.flags || [];
  const mood = !coach.result ? 'idle' : coach.result.ready ? 'cheer' : 'shrug';

  const setCriterion = (i, v) => setF((s) => ({ ...s, criteria: s.criteria.map((c, j) => (j === i ? v : c)) }));
  const addCriterion = (text = '') =>
    setF((s) => {
      if (s.criteria.length >= 8) return s;
      const blank = s.criteria.findIndex((c) => !c.trim());
      if (text && blank >= 0) return { ...s, criteria: s.criteria.map((c, j) => (j === blank ? text : c)) };
      return { ...s, criteria: [...s.criteria, text] };
    });
  const removeCriterion = (i) => setF((s) => ({ ...s, criteria: s.criteria.length > 1 ? s.criteria.filter((_, j) => j !== i) : [''] }));

  async function submit(e) {
    e.preventDefault();
    if (busy || disabled) return;
    setBusy(true);
    setErrors({});
    try {
      await onSubmit({ title: f.title, details: f.details, deadline: f.deadline, impact: f.impact, criteria: filled, proofPlan: f.proofPlan });
    } catch (err) {
      setErrors(err.fields || {});
    } finally {
      setBusy(false);
    }
  }

  return (
    <StickerCard color="paper" tilt={0} hover={false} className="outcome-form">
      <form className="outcome-form__grid" onSubmit={submit} noValidate aria-label="New outcome">
        <div className="outcome-form__fields">
          <h2 className="card-title">New outcome</h2>
          <Field label="Title" name="title" placeholder="Ship the Q3 pricing page to all visitors" maxLength={120} value={f.title} onChange={set('title')} error={errors.title} required />
          <TextArea label="Details (optional)" name="details" rows={2} maxLength={2000} value={f.details} onChange={set('details')} error={errors.details} />
          <div className="outcome-form__row">
            <Field label="Deadline" type="date" name="deadline" min={todayLocal()} value={f.deadline} onChange={set('deadline')} error={errors.deadline} required />
            <fieldset className="impact">
              <legend>
                Impact <span className="impact__label">{f.impact} · {IMPACT_LABELS[f.impact]}</span>
              </legend>
              <div className="impact__row" role="radiogroup" aria-label="Impact from 1 to 5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={f.impact === n} className={`impact__btn${f.impact === n ? ' impact__btn--on' : ''}`} onClick={() => setF((s) => ({ ...s, impact: n }))}>
                    {n}
                  </button>
                ))}
              </div>
              {errors.impact && (
                <p className="field__msg field__msg--error" role="alert">
                  {errors.impact}
                </p>
              )}
            </fieldset>
          </div>

          <fieldset className="criteria">
            <legend>Acceptance criteria</legend>
            <p className="field__msg">Sentences that are clearly true or false when you finish.</p>
            {f.criteria.map((c, i) => (
              <div className="criteria__row" key={i}>
                <input className="input" aria-label={`Criterion ${i + 1}`} placeholder="e.g. The page is live and linked from the homepage" maxLength={200} value={c} onChange={(e) => setCriterion(i, e.target.value)} />
                <button type="button" className="criteria__x" onClick={() => removeCriterion(i)} aria-label={`Remove criterion ${i + 1}`}>
                  ×
                </button>
              </div>
            ))}
            {errors.criteria && (
              <p className="field__msg field__msg--error" role="alert">
                {errors.criteria}
              </p>
            )}
            <SquishyButton size="sm" variant="ghost" onClick={() => addCriterion('')} disabled={f.criteria.length >= 8}>
              + Add criterion
            </SquishyButton>
          </fieldset>

          <TextArea label="How I will prove it" name="proofPlan" rows={2} maxLength={500} placeholder="A link to the live page and a screenshot of the analytics" value={f.proofPlan} onChange={set('proofPlan')} error={errors.proofPlan} />

          <div className="btn-row">
            <SquishyButton type="submit" burst="POW!" disabled={busy || disabled}>
              {busy ? 'Saving…' : 'Add to Planned'}
            </SquishyButton>
            <SquishyButton variant="ghost" onClick={onCancel}>
              Cancel
            </SquishyButton>
          </div>
        </div>

        <aside className="coach" aria-label="Outcome Coach" aria-live="polite">
          <Mascot mood={mood} size={110} greet={false} autoSleep={false} interactive={false} label="Tally, your outcome coach" />
          <div className="coach__body">
            <h3 className="coach__title">Outcome Coach</h3>
            {!coach.result && !coach.loading && <SpeechBubble tail="left">Type a title and I will tell you what is hard to prove.</SpeechBubble>}
            {coach.loading && !coach.result && <SpeechBubble tail="left">Reading…</SpeechBubble>}
            {coach.result?.ready && <SpeechBubble tail="left">Testable and provable. Nice.</SpeechBubble>}
            {flags.length > 0 && (
              <SpeechBubble tail="left" className="coach__flags">
                <ul>
                  {flags.map((x) => (
                    <li key={x.code}>{x.message}</li>
                  ))}
                </ul>
              </SpeechBubble>
            )}
            {coach.result?.suggestions?.length > 0 && (
              <div className="coach__suggest">
                <p className="field__msg">Suggested criteria. Click to add:</p>
                {coach.result.suggestions.map((s) => (
                  <button type="button" key={s} className="coach__chip" onClick={() => addCriterion(s)} disabled={f.criteria.length >= 8 && !f.criteria.some((c) => !c.trim())}>
                    + {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </form>
    </StickerCard>
  );
}
