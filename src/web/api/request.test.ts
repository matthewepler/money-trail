import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, requestData, requestEmpty } from './request.js';

const fetchMock = vi.fn();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ApiError);
    return error as ApiError;
  }
  throw new Error('expected the request to fail');
}

describe('requestData', () => {
  it('returns the data field of a successful response', async () => {
    fetchMock.mockResolvedValue(json(200, { data: { hello: 'world' } }));

    expect(await requestData('/api/thing')).toEqual({ hello: 'world' });
  });

  it('sends same-origin credentials and builds the query string, skipping undefined values', async () => {
    fetchMock.mockResolvedValue(json(200, { data: {} }));

    await requestData('/api/thing', { query: { from: '2026-09-01', to: undefined, limit: 50 } });

    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/thing?from=2026-09-01&limit=50');
    expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin' });
  });

  it('sends a JSON body with its content type', async () => {
    fetchMock.mockResolvedValue(json(200, { data: {} }));

    await requestData('/api/thing', { method: 'POST', json: { email: 'a@b.c' } });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'application/json' });
    expect(init.body).toBe('{"email":"a@b.c"}');
  });

  it('sends a raw text body with the content type it is given', async () => {
    fetchMock.mockResolvedValue(json(200, { data: {} }));

    await requestData('/api/thing', {
      method: 'POST',
      text: { content: 'a,b\n1,2', contentType: 'text/csv' },
    });

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init.headers).toEqual({ 'content-type': 'text/csv' });
    expect(init.body).toBe('a,b\n1,2');
  });

  it('turns the server error envelope into an ApiError with its code and status', async () => {
    fetchMock.mockResolvedValue(
      json(422, { error: { code: 'IMPORT_INVALID_ROW', message: "row 3: amount 'abc' is bad" } }),
    );

    const error = await caught(requestData('/api/thing'));

    expect(error).toMatchObject({
      code: 'IMPORT_INVALID_ROW',
      message: "row 3: amount 'abc' is bad",
      status: 422,
    });
  });

  it('reports an unreachable server as NETWORK_ERROR', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    const error = await caught(requestData('/api/thing'));

    expect(error).toMatchObject({ code: 'NETWORK_ERROR', status: 0 });
  });

  it('reports a body that is not JSON as BAD_RESPONSE, keeping the status', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));

    const error = await caught(requestData('/api/thing'));

    expect(error).toMatchObject({ code: 'BAD_RESPONSE', status: 502 });
  });

  it('reports a success response with no data field as BAD_RESPONSE', async () => {
    fetchMock.mockResolvedValue(json(200, { unexpected: true }));

    expect(await caught(requestData('/api/thing'))).toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('reports an error status without the error envelope as BAD_RESPONSE', async () => {
    fetchMock.mockResolvedValue(json(500, { oops: 1 }));

    expect(await caught(requestData('/api/thing'))).toMatchObject({
      code: 'BAD_RESPONSE',
      status: 500,
    });
  });
});

describe('requestEmpty', () => {
  it('resolves on a 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(requestEmpty('/api/thing', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('throws the server error when the request fails', async () => {
    fetchMock.mockResolvedValue(
      json(401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in required' } }),
    );

    expect(await caught(requestEmpty('/api/thing', { method: 'DELETE' }))).toMatchObject({
      code: 'AUTH_REQUIRED',
      status: 401,
    });
  });
});
