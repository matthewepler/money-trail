import { createHash, randomBytes } from 'node:crypto';
import { AuthError } from '../domain/errors.js';
import type { UserRecord } from '../repositories/userRepository.js';

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AuthDeps = {
  findUserByEmail: (email: string) => Promise<UserRecord | null>;
  verifyPassword: (hash: string, password: string) => Promise<boolean>;
  createSession: (userId: string, tokenHash: string, expiresAt: Date) => Promise<void>;
  findSession: (tokenHash: string, now: Date) => Promise<string | null>;
  deleteSession: (tokenHash: string) => Promise<void>;
  now?: () => Date;
};

export type LoginResult = {
  /** The secret to put in the cookie. Only its hash is ever stored. */
  token: string;
  expiresAt: Date;
  user: { id: string; email: string };
};

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function login(
  deps: AuthDeps,
  credentials: { email: string; password: string },
): Promise<LoginResult> {
  const now = (deps.now ?? (() => new Date()))();
  const user = await deps.findUserByEmail(credentials.email);

  // One error for "no such user" and "wrong password", so the response doesn't say which.
  if (!user || !(await deps.verifyPassword(user.passwordHash, credentials.password))) {
    throw new AuthError('AUTH_INVALID_CREDENTIALS', 'Incorrect email or password');
  }

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await deps.createSession(user.id, hashToken(token), expiresAt);

  return { token, expiresAt, user: { id: user.id, email: user.email } };
}

/** The userId for a live session token, or null. This is the only source of a userId. */
export async function authenticate(deps: AuthDeps, token: string): Promise<string | null> {
  if (token === '') return null;
  return deps.findSession(hashToken(token), (deps.now ?? (() => new Date()))());
}

export async function logout(deps: AuthDeps, token: string): Promise<void> {
  await deps.deleteSession(hashToken(token));
}
