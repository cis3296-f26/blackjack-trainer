import { useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { useAuth } from '../AuthContext';
import './AuthPage.css';

interface AuthPageProps {
  onSuccess?: () => void;
}

export default function AuthPage({ onSuccess }: AuthPageProps) {
  const searchParams = new URLSearchParams(window.location.search);
  const signUp = searchParams.get('signUp');
  const [isSignUp, setIsSignUp] = useState(signUp === 'true');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  const { signup, login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSignUp) {
      try {
        const userCredential = await signup(email, password);
        if (name) {
          await updateProfile(userCredential.user, { displayName: name });
        }
        alert('Signed up successfully!');
        setIsSignUp(false);
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = '/';
        }
      } catch (error: any) {
        alert(error.message);
      }
    } else {
      try {
        await login(email, password);
        alert('Signed in successfully!');
        if (onSuccess) {
          onSuccess();
        } else {
          window.location.href = '/';
        }
      } catch (error: any) {
        alert(error.message);
      }
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-page__card">
        <h1 className="auth-page__title">
          {isSignUp ? 'Create an Account' : 'Log in to account'}
        </h1>

        <form onSubmit={handleSubmit} className="auth-page__form">
          {isSignUp && (
            <div className="auth-page__field">
              <label className="auth-page__label">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="auth-page__input"
                required={isSignUp}
              />
            </div>
          )}

          <div className="auth-page__field">
            <label className="auth-page__label">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="auth-page__input"
              required
            />
          </div>

          <div className="auth-page__field">
            <label className="auth-page__label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="auth-page__input"
              required
            />
          </div>

          <button type="submit" className="auth-page__submit">
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="auth-page__toggle"
        >
          {isSignUp
            ? 'Already have an account? Sign in'
            : 'Need an account? Sign up'}
        </button>
      </div>
    </div>
  );
}