import { beforeEach, describe, expect, it } from 'vitest';
import { upsertUser } from '../../src/repositories/userRepository.js';
import { buildApp } from '../../src/server/app.js';
import { createAppDeps } from '../../src/server/composition.js';
import { registerRoutes } from '../../src/server/routes/index.js';
import { hashPassword } from '../../src/services/passwords.js';
import { truncateAll } from '../helpers/db.js';

const EMAIL = 'owner@example.com';
const PASSWORD = 'right-password-123';
const COOKIE = 'mt_session';

async function buildTestApp(options: { secureCookies?: boolean } = {}) {
  const app = buildApp();
  await registerRoutes(app, { ...createAppDeps(), secureCookies: options.secureCookies ?? false });
  await app.ready();
  return app;
}

async function signIn(app: Awaited<ReturnType<typeof buildTestApp>>) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/session',
    payload: { email: EMAIL, password: PASSWORD },
  });
  const cookie = response.cookies.find((c) => c.name === COOKIE);
  return { response, token: cookie?.value ?? '' };
}

beforeEach(async () => {
  await truncateAll();
  await upsertUser(EMAIL, await hashPassword(PASSWORD));
});

describe('POST /api/session', () => {
  it('signs in with the right password and sets a hardened session cookie', async () => {
    const app = await buildTestApp();

    const { response } = await signIn(app);

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { user: { email: EMAIL } } });
    const header = String(response.headers['set-cookie']);
    expect(header).toContain(`${COOKIE}=`);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).not.toContain('Secure');
  });

  it('marks the cookie Secure when configured to', async () => {
    const app = await buildTestApp({ secureCookies: true });

    const { response } = await signIn(app);

    expect(String(response.headers['set-cookie'])).toContain('Secure');
  });

  it('rejects a wrong password with 401 and sets no cookie', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/api/session',
      payload: { email: EMAIL, password: 'wrong-password-123' },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('rejects a missing or non-string field with 400', async () => {
    const app = await buildTestApp();

    for (const payload of [{}, { email: EMAIL }, { email: 5, password: PASSWORD }]) {
      const response = await app.inject({ method: 'POST', url: '/api/session', payload });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    }
  });
});

describe('the session guard', () => {
  it('answers GET /api/session with 401 when there is no cookie', async () => {
    const app = await buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/session' });

    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('AUTH_REQUIRED');
  });

  it('answers GET /api/session with 200 for a signed-in browser', async () => {
    const app = await buildTestApp();
    const { token } = await signIn(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [COOKIE]: token },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: { authenticated: true } });
  });

  it('rejects a cookie that was never issued', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [COOKIE]: 'forged-token-value' },
    });

    expect(response.statusCode).toBe(401);
  });
});

describe('DELETE /api/session', () => {
  it('revokes the session on the server, not just in the browser', async () => {
    const app = await buildTestApp();
    const { token } = await signIn(app);

    const logout = await app.inject({
      method: 'DELETE',
      url: '/api/session',
      cookies: { [COOKIE]: token },
    });
    const replay = await app.inject({
      method: 'GET',
      url: '/api/session',
      cookies: { [COOKIE]: token },
    });

    expect(logout.statusCode).toBe(204);
    expect(String(logout.headers['set-cookie'])).toContain(`${COOKIE}=;`);
    expect(replay.statusCode).toBe(401);
  });

  it('is harmless without a cookie', async () => {
    const app = await buildTestApp();

    const response = await app.inject({ method: 'DELETE', url: '/api/session' });

    expect(response.statusCode).toBe(204);
  });
});
