import { upsertUser } from '../../src/repositories/userRepository.js';
import { buildApp } from '../../src/server/app.js';
import { createAppDeps } from '../../src/server/composition.js';
import { SESSION_COOKIE } from '../../src/server/middleware/session.js';
import { registerRoutes } from '../../src/server/routes/index.js';
import { hashPassword } from '../../src/services/passwords.js';

export const TEST_PASSWORD = 'right-password-123';

export type TestApp = Awaited<ReturnType<typeof buildTestApp>>;

/** The production wiring (real repositories), minus the listening socket. */
export async function buildTestApp(options: { secureCookies?: boolean } = {}) {
  const app = buildApp();
  await registerRoutes(app, { ...createAppDeps(), secureCookies: options.secureCookies ?? false });
  await app.ready();
  return app;
}

export async function createUser(email: string, password = TEST_PASSWORD): Promise<string> {
  return upsertUser(email, await hashPassword(password));
}

export async function signIn(app: TestApp, email: string, password = TEST_PASSWORD) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/session',
    payload: { email, password },
  });
  const token = response.cookies.find((c) => c.name === SESSION_COOKIE)?.value ?? '';
  return { response, token, cookies: { [SESSION_COOKIE]: token } };
}

/** Creates a user and signs them in, returning the cookie to send on later requests. */
export async function createSignedInUser(app: TestApp, email: string) {
  const userId = await createUser(email);
  const { cookies } = await signIn(app, email);
  return { userId, cookies };
}
