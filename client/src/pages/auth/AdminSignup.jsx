import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import { useAuthForm } from './useAuthForm.js';
import Field, { PasswordField } from '../../components/Field.jsx';
import SquishyButton from '../../components/SquishyButton.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function AdminSignup() {
  const { signupAdmin } = useAuth();
  const form = useAuthForm('YAY!');
  const [f, setF] = useState({ workspaceName: '', name: '', email: '', password: '' });
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  return (
    <AuthShell
      title="Create your workspace"
      blurb="You'll get an invite code to share with your team. Outcomes get measured; busywork gets exposed."
      mood={form.mood}
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>. Joining a team instead? <Link to="/employee/signup">Use an invite code</Link>.
        </>
      }
    >
      <form className="form" onSubmit={(e) => form.run(e, () => signupAdmin(f))} noValidate>
        {form.formError && (
          <p className="form__error" role="alert">
            {form.formError}
          </p>
        )}
        <Field label="Workspace name" name="workspaceName" autoComplete="organization" placeholder="Acme Inc." value={f.workspaceName} onChange={set('workspaceName')} error={form.fields.workspaceName} required />
        <Field label="Your name" name="name" autoComplete="name" value={f.name} onChange={set('name')} error={form.fields.name} required />
        <Field label="Work email" type="email" name="email" autoComplete="email" value={f.email} onChange={set('email')} error={form.fields.email} required />
        <PasswordField label="Password" name="password" autoComplete="new-password" hint="At least 8 characters." value={f.password} onChange={set('password')} error={form.fields.password} required />
        <SquishyButton type="submit" size="lg" block disabled={form.busy}>
          {form.busy ? 'Building your workspace…' : 'Create workspace'}
        </SquishyButton>
      </form>
    </AuthShell>
  );
}
