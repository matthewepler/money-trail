import { Outlet } from 'react-router-dom';
import { useSession } from '../hooks/useSession.js';
import styles from './SessionGate.module.css';

/** Holds back every route until we know whether the browser has a session. */
export function SessionGate() {
  const { status, retry } = useSession();

  if (status === 'checking') {
    return (
      <p role="status" className={styles.message}>
        Checking your session…
      </p>
    );
  }

  if (status === 'unreachable') {
    return (
      <div className={styles.message}>
        <p role="alert">Can’t reach the server. Check your connection.</p>
        <button type="button" className={styles.retry} onClick={retry}>
          Try again
        </button>
      </div>
    );
  }

  return <Outlet />;
}
