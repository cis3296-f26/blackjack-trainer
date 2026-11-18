import { useRef, useState } from 'react';
import { useAuth } from '../auth';
import './AuthPage.css';

function errorMessage(error: unknown, signingUp: boolean): string {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'auth/network-request-failed') return 'Could not connect. Check your internet connection and try again.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a moment, then try again.';
  if (code === 'auth/email-already-in-use') return 'An account already uses this email. Try logging in instead.';
  if (code === 'auth/weak-password') return 'Choose a stronger password with at least 6 characters.';
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  return signingUp ? 'Could not create your account. Check your details and try again.' : 'Could not sign in. Check your email and password.';
}

export default function AuthPage() {
  const [isSignUp, setIsSignUp] = useState(() => new URLSearchParams(window.location.search).get('signUp') === 'true');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const { signup, login } = useAuth();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      if (isSignUp) {
        await signup(email.trim(), password, name.trim());
      } else {
        await login(email.trim(), password);
      }
      // The auth provider takes the player directly to their table.
    } catch (err: unknown) {
      setError(errorMessage(err, isSignUp));
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-brand">
        <span className="auth-brand__suit" aria-hidden="true">♠</span>
        <h1>Blackjack Trainer</h1>
        <p>Practice blackjack, one decision at a time.</p>
      </div>
      <div className="auth-page__card">
        <h2>{isSignUp ? 'Create an account' : 'Welcome back'}</h2>
        <p className="auth-page__intro">{isSignUp ? 'Take your seat and start practicing.' : 'Log in to take your seat.'}</p>
        <form onSubmit={handleSubmit} className="auth-page__form" aria-busy={pending}>
          <fieldset disabled={pending}>
            {isSignUp && (
              <div className="auth-page__field">
                <label htmlFor="auth-name">Name</label>
                <input id="auth-name" name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required />
              </div>
            )}
            <div className="auth-page__field">
              <label htmlFor="auth-email">Email</label>
              <input id="auth-email" name="email" type="email" autoComplete="username" autoCapitalize="none" spellCheck={false}
                value={email} onChange={event => setEmail(event.target.value)} required />
            </div>
            <div className="auth-page__field">
              <label htmlFor="auth-password">Password</label>
              <div className="auth-password">
                <input id="auth-password" name="password" type={visible ? 'text' : 'password'}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'} minLength={isSignUp ? 6 : undefined}
                  aria-describedby={isSignUp ? 'password-help' : undefined}
                  value={password} onChange={event => setPassword(event.target.value)} required />
                <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}
                  onClick={() => setVisible(value => !value)}>{visible ? 'Hide' : 'Show'}</button>
              </div>
              {isSignUp && <p className="auth-page__help" id="password-help">Use at least 6 characters.</p>}
            </div>
            {error && <p className="auth-page__error" role="alert">{error}</p>}
            <button type="submit" className="button button--primary auth-page__submit">
              {pending ? (isSignUp ? 'Creating account…' : 'Logging in…') : (isSignUp ? 'Create account' : 'Log in')}
            </button>
          </fieldset>
        </form>
        <button type="button" className="auth-page__toggle" disabled={pending} onClick={() => {
          setIsSignUp(value => !value); setError(''); setPassword(''); setVisible(false);
        }}>{isSignUp ? 'Already have an account? Log in' : 'Create an account'}</button>
        <p className="auth-page__footnote">Practice chips. Real learning.</p>
      </div>
    </main>
  );
}
