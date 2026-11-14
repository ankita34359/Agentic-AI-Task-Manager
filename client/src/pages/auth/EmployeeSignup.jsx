import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import { useAuthForm } from './useAuthForm.js';
import Field, { PasswordField } from '../../components/Field.jsx';
import SquishyButton from '../../components/SquishyButton.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../lib/api.js';

// "abcd efgh" / "abcd-efgh" / "ABCDEFGH" → "ABCD-EFGH" (8 symbols max)
const formatCode = (raw) => {
  const c = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c;
};

export default function EmployeeSignup() {
  const { signupEmployee } = useAuth();
  const [params] = useSearchParams();
  const form = useAuthForm('YAY!');
  const [f, setF] = useState({ inviteCode: formatCode(params.get('code') || ''), name: '', email: '', password: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const [invite, setInvite] = useState({ state: 'idle', workspaceName: '' }); // idle | checking | valid | invalid
  const seq = useRef(0);

  // Live-check the code once it has all 8 symbols (debounced; stale answers are ignored).
  useEffect(() => {
    const code = f.inviteCode.replace('-', '');
    if (code.length < 8) {
      setInvite({ state: 'idle', workspaceName: '' });
      return undefined;
    }
    const mine = ++seq.current;
    setInvite({ state: 'checking', workspaceName: '' });
    const t = setTimeout(async () => {
      try {
        const r = await api.get(`/api/auth/invite/${encodeURIComponent(code)}`);
        if (mine === seq.current) setInvite(r.valid ? { state: 'valid', workspaceName: r.workspaceName } : { state: 'invalid', workspaceName: '' });
      } catch {
        if (mine === seq.current) setInvite({ state: 'idle', workspaceName: '' });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [f.inviteCode]);

  const status =
    invite.state === 'valid'
      ? { kind: 'ok', text: `✓ You're joining ${invite.workspaceName}` }
      : invite.state === 'checking'
        ? { kind: 'info', text: 'Checking the code…' }
        : null;
  const codeError = form.fields.inviteCode || (invite.state === 'invalid' ? 'No workspace has that code. Typo?' : undefined);

  return (
    <AuthShell
      title="Join your team"
      blurb="Ask your admin for the invite code. Then three outcomes a day, each with proof."
      mood={form.mood}
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>. Setting up a company? <Link to="/admin/signup">Create a workspace</Link>.
        </>
      }
    >
      <form className="form" onSubmit={(e) => form.run(e, () => signupEmployee(f))} noValidate>
        {form.formError && (
          <p className="form__error" role="alert">
            {form.formError}
          </p>
        )}
        <Field
          label="Invite code"
          name="inviteCode"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="ABCD-EFGH"
          className="field--code"
          value={f.inviteCode}
          onChange={(e) => setF((s) => ({ ...s, inviteCode: formatCode(e.target.value) }))}
          error={codeError}
          status={status}
          required
        />
        <Field label="Your name" name="name" autoComplete="name" value={f.name} onChange={set('name')} error={form.fields.name} required />
        <Field label="Work email" type="email" name="email" autoComplete="email" value={f.email} onChange={set('email')} error={form.fields.email} required />
        <PasswordField label="Password" name="password" autoComplete="new-password" hint="At least 8 characters." value={f.password} onChange={set('password')} error={form.fields.password} required />
        <SquishyButton type="submit" size="lg" block disabled={form.busy}>
          {form.busy ? 'Joining…' : 'Join workspace'}
        </SquishyButton>
      </form>
    </AuthShell>
  );
}
