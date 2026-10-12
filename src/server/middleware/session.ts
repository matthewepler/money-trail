import type { FastifyInstance } from 'fastify';
import { AuthError } from '../../domain/errors.js';
import { authenticate, type AuthDeps } from '../../services/auth.js';

export const SESSION_COOKIE = 'mt_session';

/**
 * Makes every route registered on `scope` require a live session, and sets `request.userId`
 * from it. That is the only place a userId enters a request.
 */
export function requireSession(scope: FastifyInstance, auth: AuthDeps): void {
  scope.decorateRequest('userId', '');
  scope.addHook('onRequest', async (request) => {
    const token = request.cookies[SESSION_COOKIE] ?? '';
    const userId = await authenticate(auth, token);
    if (!userId) throw new AuthError('AUTH_REQUIRED', 'Sign in required');
    request.userId = userId;
  });
}
