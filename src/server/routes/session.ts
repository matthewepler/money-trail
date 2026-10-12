import type { FastifyInstance } from 'fastify';
import { ValidationError } from '../../domain/errors.js';
import { login, logout } from '../../services/auth.js';
import { SESSION_COOKIE } from '../middleware/session.js';
import type { RouteDeps } from './index.js';

function readCredentials(body: unknown): { email: string; password: string } {
  const { email, password } = (typeof body === 'object' && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    throw new ValidationError('email and password are required');
  }
  return { email, password };
}

export function publicSessionRoutes(app: FastifyInstance, deps: RouteDeps): void {
  app.post('/api/session', async (request, reply) => {
    const session = await login(deps.auth, readCredentials(request.body));
    reply.setCookie(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: deps.secureCookies,
      path: '/',
      expires: session.expiresAt,
    });
    return { data: { user: { email: session.user.email } } };
  });

  app.delete('/api/session', async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE];
    if (token) await logout(deps.auth, token);
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.status(204).send();
  });
}

export function sessionStatusRoute(scope: FastifyInstance): void {
  scope.get('/api/session', async () => ({ data: { authenticated: true } }));
}
