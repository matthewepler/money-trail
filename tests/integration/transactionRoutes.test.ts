import { beforeEach, describe, expect, it } from 'vitest';
import { insertTransactions } from '../../src/repositories/transactionRepository.js';
import { buildTestApp, createSignedInUser } from '../helpers/app.js';
import { truncateAll } from '../helpers/db.js';

const txn = (
  date: string,
  description: string,
  amountCents = -500,
  category: string | null = null,
) => ({
  date,
  description,
  amountCents,
  account: 'chase-checking',
  category,
  source: 'chase-csv',
  externalId: null,
});

beforeEach(async () => {
  await truncateAll();
});

describe('GET /api/transactions', () => {
  it('requires a signed-in user', async () => {
    const app = await buildTestApp();

    const response = await app.inject({ method: 'GET', url: '/api/transactions' });

    expect(response.statusCode).toBe(401);
  });

  it('lists the user’s transactions newest first, with only the fields the client needs', async () => {
    const app = await buildTestApp();
    const { userId, cookies } = await createSignedInUser(app, 'owner@example.com');
    await insertTransactions(userId, [
      txn('2026-09-01', 'OLDER'),
      txn('2026-09-20', 'NEWER', -1250, 'FOOD_AND_DRINK'),
    ]);

    const response = await app.inject({ method: 'GET', url: '/api/transactions', cookies });

    expect(response.statusCode).toBe(200);
    const { data } = response.json();
    expect(data.nextOffset).toBeNull();
    expect(data.transactions.map((t: { description: string }) => t.description)).toEqual([
      'NEWER',
      'OLDER',
    ]);
    expect(data.transactions[0]).toEqual({
      id: expect.any(String),
      date: '2026-09-20',
      description: 'NEWER',
      amountCents: -1250,
      account: 'chase-checking',
      category: 'FOOD_AND_DRINK',
    });
  });

  it('never shows another user’s transactions', async () => {
    const app = await buildTestApp();
    const owner = await createSignedInUser(app, 'owner@example.com');
    const other = await createSignedInUser(app, 'other@example.com');
    await insertTransactions(owner.userId, [txn('2026-09-20', 'OWNER ONLY')]);

    const response = await app.inject({
      method: 'GET',
      url: `/api/transactions?userId=${owner.userId}`,
      cookies: other.cookies,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().data.transactions).toEqual([]);
  });

  it('filters by an inclusive date range', async () => {
    const app = await buildTestApp();
    const { userId, cookies } = await createSignedInUser(app, 'owner@example.com');
    await insertTransactions(userId, [
      txn('2026-08-31', 'BEFORE'),
      txn('2026-09-01', 'FIRST'),
      txn('2026-09-30', 'LAST'),
      txn('2026-10-01', 'AFTER'),
    ]);

    const response = await app.inject({
      method: 'GET',
      url: '/api/transactions?from=2026-09-01&to=2026-09-30',
      cookies,
    });

    expect(
      response
        .json()
        .data.transactions.map((t: { description: string }) => t.description)
        .sort(),
    ).toEqual(['FIRST', 'LAST']);
  });

  it('pages through the ledger without repeats or gaps', async () => {
    const app = await buildTestApp();
    const { userId, cookies } = await createSignedInUser(app, 'owner@example.com');
    await insertTransactions(
      userId,
      Array.from({ length: 8 }, (_, i) => txn('2026-09-20', `ROW ${i}`)),
    );

    type Page = { transactions: { id: string }[]; nextOffset: number | null };
    const fetchPage = async (offset: number): Promise<Page> => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/transactions?limit=3&offset=${offset}`,
        cookies,
      });
      return response.json().data;
    };

    const seen: string[] = [];
    let pages = 0;
    for (let offset: number | null = 0; offset !== null;) {
      const page: Page = await fetchPage(offset);
      seen.push(...page.transactions.map((t) => t.id));
      offset = page.nextOffset;
      pages += 1;
    }

    expect(pages).toBe(3);
    expect(seen).toHaveLength(8);
    expect(new Set(seen).size).toBe(8);
  });

  it('rejects bad query values with a 400 naming the problem', async () => {
    const app = await buildTestApp();
    const { cookies } = await createSignedInUser(app, 'owner@example.com');

    const cases: [string, RegExp][] = [
      ['limit=0', /limit/],
      ['limit=501', /limit/],
      ['limit=abc', /limit/],
      ['limit=2.5', /limit/],
      ['offset=-1', /offset/],
      ['from=2026-13-01', /from/],
      ['to=09/30/2026', /to/],
      ['from=2026-09-30&to=2026-09-01', /from.*to|before/],
    ];
    for (const [query, message] of cases) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/transactions?${query}`,
        cookies,
      });
      expect(response.statusCode, query).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
      expect(response.json().error.message, query).toMatch(message);
    }
  });
});
