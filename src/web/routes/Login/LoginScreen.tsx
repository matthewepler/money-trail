import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiError } from '../../api/request.js';
import { useSession } from '../../hooks/useSession.js';
import controls from '../../styles/controls.module.css';
import styles from './LoginScreen.module.css';

function messageFor(error: unknown): string {
  switch (error instanceof ApiError ? error.code : null) {
    case 'AUTH_INVALID_CREDENTIALS':
      return 'Incorrect email or password.';
    case 'VALIDATION_ERROR':
      return 'Enter your email and password.';
    case 'NETWORK_ERROR':
      return 'Can’t reach the server. Check your connection and try again.';
    default:
      return 'Something went wrong. Try again.';
  }
}

export function LoginScreen() {
  const { status, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'signedIn') return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (caught) {
      setError(messageFor(caught));
      setPending(false);
    }
  }

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={(event) => void handleSubmit(event)} noValidate>
        <h1 className={styles.title}>Sign in</h1>
        {error && (
          <p role="alert" className={controls.error}>
            {error}
          </p>
        )}
        <div className={controls.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className={controls.input}
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className={controls.field}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            className={controls.input}
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <button type="submit" className={controls.button} disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
