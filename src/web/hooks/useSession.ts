import { createContext, useContext } from 'react';

export type SessionStatus = 'checking' | 'signedIn' | 'signedOut' | 'unreachable';

export type Session = {
  status: SessionStatus;
  signIn: (email: string, password: string) => Promise<void>;
  /** Rejects if the server could not end the session, leaving the user signed in. */
  signOut: () => Promise<void>;
  /** For when any call comes back AUTH_REQUIRED: the session ended while the page was open. */
  expire: () => void;
  retry: () => void;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}
