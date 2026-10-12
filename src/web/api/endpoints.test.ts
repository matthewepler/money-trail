import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchSummary, fetchTransactions, importCsv } from './ledger.js';
import { ApiError } from './request.js';
import { getSessionStatus, signIn, signOut } from './session.js';

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

describe('session endpoints', () => {
  it('signs in by posting the credentials as JSON', async () => {
    fetchMock.mockResolvedValue(json(200, { data: { user: { email: 'me@example.com' } } }));

    const result = await signIn('me@example.com', 'a-long-password');

    expect(result).toEqual({ user: { email: 'me@example.com' } });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/session');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ email: 'me@example.com', password: 'a-long-password' });
  });

  it('signs out with a DELETE', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await signOut();

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'DELETE' });
  });

  it('reports a live session as true', async () => {
    fetchMock.mockResolvedValue(json(200, { data: { authenticated: true } }));

    expect(await getSessionStatus()).toBe(true);
  });

  it('reports "not signed in" as false rather than an error', async () => {
    fetchMock.mockResolvedValue(
      json(401, { error: { code: 'AUTH_REQUIRED', message: 'Sign in required' } }),
    );

    expect(await getSessionStatus()).toBe(false);
  });

  it('still throws when the server itself is failing', async () => {
    fetchMock.mockResolvedValue(
      json(500, { error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }),
    );

    await expect(getSessionStatus()).rejects.toBeInstanceOf(ApiError);
  });
});

describe('ledger endpoints', () => {
  it('fetches a page of transactions with its filters', async () => {
    const page = { transactions: [], nextOffset: null };
    fetchMock.mockResolvedValue(json(200, { data: page }));

    const result = await fetchTransactions({
      from: '2026-09-01',
      to: '2026-09-30',
      limit: 50,
      offset: 100,
    });

    expect(result).toEqual(page);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      '/api/transactions?from=2026-09-01&to=2026-09-30&limit=50&offset=100',
    );
  });

  it('fetches the spending summary for a range', async () => {
    const summary = { categories: [], totalCents: 0, transfersOut: { totalCents: 0 } };
    fetchMock.mockResolvedValue(json(200, { data: summary }));

    expect(await fetchSummary({ from: '2026-09-01', to: '2026-09-30' })).toEqual(summary);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/summary?from=2026-09-01&to=2026-09-30');
  });

  it('imports a CSV as a text/csv body, labelling the account in the query', async () => {
    fetchMock.mockResolvedValue(json(201, { data: { imported: 8, uncategorized: 2 } }));

    const result = await importCsv('a,b\n1,2\n', 'Chase checking');

    expect(result).toEqual({ imported: 8, uncategorized: 2 });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe('/api/imports?account=Chase+checking');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'content-type': 'text/csv' });
    expect(init.body).toBe('a,b\n1,2\n');
  });
});
