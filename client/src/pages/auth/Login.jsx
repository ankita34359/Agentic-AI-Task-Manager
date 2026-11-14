import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from './AuthShell.jsx';
import { useAuthForm } from './useAuthForm.js';
import Field, { PasswordField } from '../../components/Field.jsx';
import SquishyButton from '../../components/SquishyButton.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const form = useAuthForm('HI!');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <AuthShell
      title="Welcome back"
      blurb="Log in to pick up where your outcomes left off."
      mood={form.mood}
      footer={
        <>
          New here? <Link to="/admin/signup">Create a workspace</Link> or <Link to="/employee/signup">join with an invite code</Link>.
        </>
      }
    >
      <form className="form" onSubmit={(e) => form.run(e, () => login(email, password))} noValidate>
        {form.formError && (
          <p className="form__error" role="alert">
            {form.formError}
          </p>
        )}
        <Field label="Email" type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <PasswordField label="Password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <SquishyButton type="submit" size="lg" block disabled={form.busy}>
          {form.busy ? 'Checking…' : 'Log in'}
        </SquishyButton>
      </form>
    </AuthShell>
  );
}
