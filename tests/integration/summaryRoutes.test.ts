import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildTestApp, createSignedInUser, type TestApp } from '../helpers/app.js';
import { truncateAll } from '../helpers/db.js';

const fixture = readFileSync(path.resolve(process.cwd(), 'fixtures/chase-checking.csv'), 'utf8');

async function importFixture(app: TestApp, cookies: Record<string, string>) {
  await app.inject({
    method: 'POST',
    url: '/api/imports?account=chase-checking',
    headers: { 'content-type': 'text/csv' },
    cookies,
    payload: fixture,
  });
}

beforeEach(async () => {
  await truncateAll();
});

describe('GET /api/summary', () => {
  it('requires a signed-in user', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/summary?from=2026-09-01&to=2026-09-30',
    });

    expect(response.statusCode).toBe(401);
  });

  it('summarizes an imported file as spending, with transfers on their own line', async () => {
    const app = await buildTestApp();
    const { cookies } = await createSignedInUser(app, 'owner@example.com');
    await importFixture(app, cookies);

    const response = await app.inject({
      method: 'GET',
      url: '/api/summary?from=2026-09-01&to=2026-09-30',
      cookies,
    });

    expect(response.statusCode).toBe(200);
    // The fixture: two bakery rows, payroll (income), a check and a market charge no rule
    // matches, a transfer to savings, a service fee, and an ATM withdrawal.
    expect(response.json()).toEqual({
      data: {
        categories: [
          { category: null, totalCents: -14390 },
          { category: 'BANK_FEES', totalCents: -1200 },
          { category: 'FOOD_AND_DRINK', totalCents: -950 },
        ],
        totalCents: -16540,
        transfersOut: { totalCents: -56000 },
      },
    });
  });

  it('only counts transactions inside the requested range', async () => {
    const app = await buildTestApp();
    const { cookies } = await createSignedInUser(app, 'owner@example.com');
    await importFixture(app, cookies);

    const response = await app.inject({
      method: 'GET',
      url: '/api/summary?from=2026-10-01&to=2026-10-31',
      cookies,
    });

    expect(response.json().data).toEqual({
      categories: [],
      totalCents: 0,
      transfersOut: { totalCents: 0 },
    });
  });

  it('never includes another user’s transactions', async () => {
    const app = await buildTestApp();
    const owner = await createSignedInUser(app, 'owner@example.com');
    const other = await createSignedInUser(app, 'other@example.com');
    await importFixture(app, owner.cookies);

    const response = await app.inject({
      method: 'GET',
      url: `/api/summary?from=2026-09-01&to=2026-09-30&userId=${owner.userId}`,
      cookies: other.cookies,
    });

    expect(response.json().data.totalCents).toBe(0);
  });

  it('requires both ends of the range, as real dates in order', async () => {
    const app = await buildTestApp();
    const { cookies } = await createSignedInUser(app, 'owner@example.com');

    const cases: [string, RegExp][] = [
      ['', /from and to/],
      ['?from=2026-09-01', /from and to/],
      ['?to=2026-09-30', /from and to/],
      ['?from=2026-02-30&to=2026-09-30', /from/],
      ['?from=2026-09-30&to=2026-09-01', /before|after/],
    ];
    for (const [query, message] of cases) {
      const response = await app.inject({ method: 'GET', url: `/api/summary${query}`, cookies });
      expect(response.statusCode, query).toBe(400);
      expect(response.json().error.message, query).toMatch(message);
    }
  });
});
