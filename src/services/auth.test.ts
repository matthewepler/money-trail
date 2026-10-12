import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AuthError } from '../domain/errors.js';
import { authenticate, login, logout, SESSION_TTL_MS, type AuthDeps } from './auth.js';

const USER = { id: 'user-1', email: 'owner@example.com', passwordHash: 'hash-of-right-password' };
const START = new Date('2026-10-11T12:00:00Z');

function fakeDeps(clock = { now: START }) {
  const sessions = new Map<string, { userId: string; expiresAt: Date }>();
  const deps: AuthDeps = {
    findUserByEmail: async (email) => (email === USER.email ? USER : null),
    verifyPassword: async (hash, password) =>
      hash === USER.passwordHash && password === 'right-password',
    createSession: async (userId, tokenHash, expiresAt) => {
      sessions.set(tokenHash, { userId, expiresAt });
    },
    findSession: async (tokenHash, now) => {
      const session = sessions.get(tokenHash);
      return session && session.expiresAt > now ? session.userId : null;
    },
    deleteSession: async (tokenHash) => {
      sessions.delete(tokenHash);
    },
    now: () => clock.now,
  };
  return { deps, sessions, clock };
}

const credentials = { email: 'owner@example.com', password: 'right-password' };

describe('auth service', () => {
  it('logs in with the right password and returns a session token that authenticates', async () => {
    const { deps } = fakeDeps();

    const session = await login(deps, credentials);

    expect(session.user).toEqual({ id: 'user-1', email: 'owner@example.com' });
    expect(session.expiresAt).toEqual(new Date(START.getTime() + SESSION_TTL_MS));
    expect(await authenticate(deps, session.token)).toBe('user-1');
  });

  it('stores only a hash of the token, never the token itself', async () => {
    const { deps, sessions } = fakeDeps();

    const { token } = await login(deps, credentials);

    expect([...sessions.keys()]).toEqual([createHash('sha256').update(token).digest('hex')]);
  });

  it('issues a different token on every login', async () => {
    const { deps } = fakeDeps();

    const first = await login(deps, credentials);
    const second = await login(deps, credentials);

    expect(first.token).not.toBe(second.token);
  });

  it('rejects a wrong password without creating a session', async () => {
    const { deps, sessions } = fakeDeps();

    const attempt = login(deps, { ...credentials, password: 'wrong-password' });

    await expect(attempt).rejects.toThrow(AuthError);
    await expect(attempt).rejects.toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    expect(sessions.size).toBe(0);
  });

  it('gives an unknown email the same error as a wrong password', async () => {
    const { deps } = fakeDeps();

    const wrongPassword = await login(deps, { ...credentials, password: 'nope' }).catch((e) => e);
    const unknownEmail = await login(deps, { ...credentials, email: 'x@example.com' }).catch(
      (e) => e,
    );

    expect(unknownEmail).toBeInstanceOf(AuthError);
    expect(unknownEmail.code).toBe(wrongPassword.code);
    expect(unknownEmail.message).toBe(wrongPassword.message);
  });

  it('does not authenticate an unknown or empty token', async () => {
    const { deps } = fakeDeps();

    expect(await authenticate(deps, 'not-a-real-token')).toBeNull();
    expect(await authenticate(deps, '')).toBeNull();
  });

  it('stops authenticating once the session has expired', async () => {
    const { deps, clock } = fakeDeps();
    const { token } = await login(deps, credentials);

    clock.now = new Date(START.getTime() + SESSION_TTL_MS + 1);

    expect(await authenticate(deps, token)).toBeNull();
  });

  it('ends the session on logout', async () => {
    const { deps } = fakeDeps();
    const { token } = await login(deps, credentials);

    await logout(deps, token);

    expect(await authenticate(deps, token)).toBeNull();
  });
});
