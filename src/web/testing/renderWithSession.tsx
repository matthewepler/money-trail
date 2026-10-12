import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { SessionContext, type Session } from '../hooks/useSession.js';

/** Renders under a signed-in fake session whose spies a test can assert on. */
export function renderWithSession(ui: ReactElement, overrides: Partial<Session> = {}) {
  const session: Session = {
    status: 'signedIn',
    signIn: vi.fn(),
    signOut: vi.fn(),
    expire: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
  return {
    session,
    ...render(<SessionContext.Provider value={session}>{ui}</SessionContext.Provider>),
  };
}
