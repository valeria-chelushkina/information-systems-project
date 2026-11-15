import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ApiError } from '@/helpers/api';
import { errorMessage } from '@/helpers/format';
import { isStaff } from '@/helpers/user';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import type { LoginMode } from '@/typedefs/auth.typedefs';

function safeNext(value: string | null): string | undefined {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return undefined;
  }

  return value;
}

export function LoginPage() {
  const { user, login, register } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<LoginMode>(params.get('mode') === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const next = safeNext(params.get('next'));

  if (user) {
    return <Navigate to={next ?? (isStaff(user) ? '/admin' : '/')} replace />;
  }

  const switchMode = (nextMode: LoginMode) => {
    setMode(nextMode);
    setError(null);
    setPassword('');
    setConfirm('');
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === 'register' && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);

    try {
      const signedIn =
        mode === 'register'
          ? await register(email, password)
          : await login(email, password);

      push(mode === 'register' ? 'Your account is ready.' : 'Welcome to Concert Ops.');
      navigate(next ?? (isStaff(signedIn) ? '/admin' : '/'), { replace: true });
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'request_failed';
      setError(errorMessage(code));
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <section className="auth">
      <div className="container auth__inner">
        <div className="auth__brand">
          <span className="eyebrow eyebrow--pill">
            <Icon name="shield" className="icon icon--xs" />
            Secure access
          </span>
          <h1>Run your concert venue from one place</h1>
          <p>
            Events, ticket tiers, bookings, orders and users in a single interface. What you can
            see depends on your role.
          </p>
          <ul className="auth__points">
            <li>
              <Icon name="check" className="icon icon--sm" />
              Session is stored in an httpOnly cookie
            </li>
            <li>
              <Icon name="check" className="icon icon--sm" />
              Tokens are verified through auth introspection
            </li>
            <li>
              <Icon name="check" className="icon icon--sm" />
              Roles: admin, staff or customer
            </li>
          </ul>
          <div className="auth__demo">
            <span className="auth__demo-label">Demo access</span>
            <code>admin@example.com</code>
            <code>admin-password</code>
          </div>
        </div>

        <div className="auth__card">
          <div className="auth__card-head">
            <div>
              <h2>{isRegister ? 'Create your account' : 'Welcome back'}</h2>
              <p>
                {isRegister
                  ? 'Sign up to buy tickets and follow your orders'
                  : 'Sign in with your Concert Ops account'}
              </p>
            </div>
          </div>

          <div className="auth__tabs" role="tablist" aria-label="Authentication mode">
            <button
              className={`auth__tab${mode === 'login' ? ' is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => switchMode('login')}
            >
              Sign in
            </button>
            <button
              className={`auth__tab${isRegister ? ' is-active' : ''}`}
              type="button"
              role="tab"
              aria-selected={isRegister}
              onClick={() => switchMode('register')}
            >
              Create account
            </button>
          </div>

          {error ? (
            <div className="inline-error" role="alert">
              <Icon name="bell" className="icon icon--sm" />
              {error}
            </div>
          ) : null}

          <form className="form" onSubmit={onSubmit}>
            <label className="field">
              <span className="field__label">Email</span>
              <input
                className="input"
                type="email"
                name="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field__label">Password</span>
              <input
                className="input"
                type="password"
                name="password"
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={isRegister ? 8 : 1}
              />
            </label>
            {isRegister ? (
              <label className="field">
                <span className="field__label">Confirm password</span>
                <input
                  className="input"
                  type="password"
                  name="confirm"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  required
                  minLength={8}
                />
              </label>
            ) : null}
            <button className="btn btn--primary btn--block btn--lg" type="submit" disabled={busy}>
              {busy
                ? isRegister
                  ? 'Creating account…'
                  : 'Signing in…'
                : isRegister
                  ? 'Create account'
                  : 'Sign in'}
              {busy ? (
                <span className="spinner spinner--sm" />
              ) : (
                <Icon name="arrow" className="icon icon--sm" />
              )}
            </button>
          </form>

          <p className="auth__hint">
            {isRegister
              ? 'New accounts are created with the customer role. Staff access is granted by an administrator.'
              : 'Customers browse the catalogue and manage their own tickets. Staff and admins get the control panel.'}
          </p>

          <button
            className="auth__switch"
            type="button"
            onClick={() => switchMode(isRegister ? 'login' : 'register')}
          >
            {isRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </button>

          <Link className="auth__back" to="/">
            <Icon name="arrow" className="icon icon--sm icon--flip" />
            Back to the site
          </Link>
        </div>
      </div>
    </section>
  );
}
