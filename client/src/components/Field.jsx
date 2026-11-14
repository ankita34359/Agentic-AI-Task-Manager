import { useId, useState } from 'react';

/**
 * Labelled input with an accessible error/hint message.
 * `status` (optional) renders a live note under the input: { kind: 'ok' | 'error' | 'info', text }.
 */
export default function Field({ label, error, hint, status, trailing, className = '', ...input }) {
  const id = useId();
  const msgId = `${id}-msg`;
  const note = error ? { kind: 'error', text: error } : status || (hint ? { kind: 'hint', text: hint } : null);
  return (
    <div className={`field${error ? ' field--error' : ''} ${className}`}>
      <label htmlFor={id}>{label}</label>
      <div className="field__control">
        <input id={id} className="input" aria-invalid={error ? true : undefined} aria-describedby={note ? msgId : undefined} {...input} />
        {trailing}
      </div>
      {note && (
        <p id={msgId} className={`field__msg field__msg--${note.kind}`} role={note.kind === 'error' ? 'alert' : 'status'}>
          {note.text}
        </p>
      )}
    </div>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordField({ autoComplete = 'current-password', ...props }) {
  const [shown, setShown] = useState(false);
  return (
    <Field
      {...props}
      type={shown ? 'text' : 'password'}
      autoComplete={autoComplete}
      trailing={
        <button type="button" className="pw-toggle" onClick={() => setShown((s) => !s)} aria-pressed={shown} aria-label={shown ? 'Hide password' : 'Show password'}>
          {shown ? 'Hide' : 'Show'}
        </button>
      }
    />
  );
}
