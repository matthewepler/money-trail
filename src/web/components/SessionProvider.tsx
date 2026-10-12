import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSessionStatus, signIn as apiSignIn, signOut as apiSignOut } from '../api/session.js';
import { SessionContext, type Session, type SessionStatus } from '../hooks/useSession.js';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    getSessionStatus().then(
      (signedIn) => current && setStatus(signedIn ? 'signedIn' : 'signedOut'),
      () => current && setStatus('unreachable'),
    );
    return () => {
      current = false;
    };
  }, [attempt]);

  const value = useMemo<Session>(
    () => ({
      status,
      signIn: async (email, password) => {
        await apiSignIn(email, password);
        setStatus('signedIn');
      },
      signOut: async () => {
        await apiSignOut();
        setStatus('signedOut');
      },
      expire: () => setStatus('signedOut'),
      retry: () => {
        setStatus('checking');
        setAttempt((n) => n + 1);
      },
    }),
    [status],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
