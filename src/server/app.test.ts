import { describe, expect, it } from 'vitest';
import { ImportError, ValidationError } from '../domain/errors.js';
import { buildApp } from './app.js';

async function appWithRoutes() {
  const app = buildApp();
  app.get('/validation', async () => {
    throw new ValidationError('from must be a date');
  });
  app.get('/import', async () => {
    throw new ImportError('IMPORT_INVALID_ROW', 'row 3: bad date');
  });
  app.get('/unexpected', async () => {
    throw new Error('connect ECONNREFUSED postgres://money_trail:hunter2@localhost:5432/db');
  });
  app.post('/json', async (request) => ({ data: request.body }));
  await app.ready();
  return app;
}

describe('buildApp error handling', () => {
  it('maps a ValidationError to 400 with its code and message', async () => {
    const app = await appWithRoutes();

    const response = await app.inject({ method: 'GET', url: '/validation' });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: { code: 'VALIDATION_ERROR', message: 'from must be a date' },
    });
  });

  it('maps an ImportError to 422, keeping its code and the row context', async () => {
    const app = await appWithRoutes();

    const response = await app.inject({ method: 'GET', url: '/import' });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toEqual({
      error: { code: 'IMPORT_INVALID_ROW', message: 'row 3: bad date' },
    });
  });

  it('hides the message of an unexpected error behind a generic 500', async () => {
    const app = await appWithRoutes();

    const response = await app.inject({ method: 'GET', url: '/unexpected' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
    expect(response.body).not.toContain('hunter2');
  });

  it('answers an unknown route with a 404 in the same error shape', async () => {
    const app = await appWithRoutes();

    const response = await app.inject({ method: 'GET', url: '/nope' });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  it('answers malformed JSON with a 400 BAD_REQUEST, not a 500', async () => {
    const app = await appWithRoutes();

    const response = await app.inject({
      method: 'POST',
      url: '/json',
      headers: { 'content-type': 'application/json' },
      payload: '{ not json',
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('BAD_REQUEST');
  });

  it('answers an oversized body with a 413 PAYLOAD_TOO_LARGE', async () => {
    const app = buildApp({ bodyLimit: 10 });
    app.post('/json', async (request) => ({ data: request.body }));
    await app.ready();

    const response = await app.inject({
      method: 'POST',
      url: '/json',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ text: 'this is longer than ten bytes' }),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
