import cookie from '@fastify/cookie';
import type { FastifyInstance } from 'fastify';
import type { AuthDeps } from '../../services/auth.js';
import type { ImporterDeps } from '../../services/importer.js';
import { requireSession } from '../middleware/session.js';
import { importRoutes } from './imports.js';
import { publicSessionRoutes, sessionStatusRoute } from './session.js';

export type RouteDeps = {
  auth: AuthDeps;
  importer: ImporterDeps;
  /** Secure cookies need HTTPS (localhost excepted in some browsers); on only in production. */
  secureCookies: boolean;
};

export async function registerRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  await app.register(cookie);
  publicSessionRoutes(app, deps);

  // Everything registered in here needs a signed-in user.
  await app.register(async (scope) => {
    requireSession(scope, deps.auth);
    sessionStatusRoute(scope);
    importRoutes(scope, deps);
  });
}
