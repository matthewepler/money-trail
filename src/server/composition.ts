import { createSession, deleteSession, findSession } from '../repositories/sessionRepository.js';
import { findUserByEmail } from '../repositories/userRepository.js';
import { verifyPassword } from '../services/passwords.js';
import type { RouteDeps } from './routes/index.js';

/** The one place real repositories are handed to services. */
export function createAppDeps(): Pick<RouteDeps, 'auth'> {
  return {
    auth: { findUserByEmail, verifyPassword, createSession, findSession, deleteSession },
  };
}
