import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useSession } from '../hooks/useSession.js';
import styles from './Shell.module.css';

export function Shell() {
  const { signOut } = useSession();
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function handleSignOut() {
    setSignOutFailed(false);
    try {
      await signOut();
    } catch {
      setSignOutFailed(true);
    }
  }

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>money-trail</span>
        <button type="button" className={styles.signOut} onClick={() => void handleSignOut()}>
          Sign out
        </button>
      </header>
      {signOutFailed && (
        <p role="alert" className={styles.alert}>
          Couldn’t sign out. Check your connection and try again.
        </p>
      )}
      <main className={styles.main}>
        <Outlet />
      </main>
      <nav aria-label="Main" className={styles.nav}>
        <NavLink to="/" end className={styles.link}>
          Transactions
        </NavLink>
        <NavLink to="/summary" className={styles.link}>
          Summary
        </NavLink>
      </nav>
    </div>
  );
}
