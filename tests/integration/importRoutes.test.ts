import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { listTransactions } from '../../src/repositories/transactionRepository.js';
import { buildTestApp, createSignedInUser } from '../helpers/app.js';
import { truncateAll } from '../helpers/db.js';

const fixture = readFileSync(path.resolve(process.cwd(), 'fixtures/chase-checking.csv'), 'utf8');
const csv = { 'content-type': 'text/csv' };

beforeEach(async () => {
  await truncateAll();
});

describe('POST /api/imports', () => {
  it('requires a signed-in user and stores nothing without one', async () => {
    const app = await buildTestApp();
    const { userId } = await createSignedInUser(app, 'owner@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/imports?account=chase-checking',
      headers: csv,
      payload: fixture,
    });

    expect(response.statusCode).toBe(401);
    expect(await listTransactions(userId)).toHaveLength(0);
  });

  it('imports the CSV for the signed-in user and reports the counts', async () => {
    const app = await buildTestApp();
    const { userId, cookies } = await createSignedInUser(app, 'owner@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/imports?account=chase-checking',
      headers: csv,
      cookies,
      payload: fixture,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ data: { imported: 8, uncategorized: 2 } });
    const stored = await listTransactions(userId);
    expect(stored).toHaveLength(8);
    expect(stored.every((t) => t.account === 'chase-checking' && t.source === 'chase-csv')).toBe(
      true,
    );
  });

  it('takes the user from the session, ignoring any userId in the request', async () => {
    const app = await buildTestApp();
    const { userId: victimId } = await createSignedInUser(app, 'victim@example.com');
    const { userId: attackerId, cookies } = await createSignedInUser(app, 'attacker@example.com');

    await app.inject({
      method: 'POST',
      url: `/api/imports?account=chase-checking&userId=${victimId}&user_id=${victimId}`,
      headers: csv,
      cookies,
      payload: fixture,
    });

    expect(await listTransactions(victimId)).toHaveLength(0);
    expect(await listTransactions(attackerId)).toHaveLength(8);
  });

  it('requires an account label', async () => {
    const app = await buildTestApp();
    const { cookies } = await createSignedInUser(app, 'owner@example.com');

    for (const url of [
      '/api/imports',
      '/api/imports?account=',
      `/api/imports?account=${'x'.repeat(101)}`,
    ]) {
      const response = await app.inject({
        method: 'POST',
        url,
        headers: csv,
        cookies,
        payload: fixture,
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('rejects a file that is not a Chase checking export with 422 and stores nothing', async () => {
    const app = await buildTestApp();
    const { userId, cookies } = await createSignedInUser(app, 'owner@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/imports?account=chase-checking',
      headers: csv,
      cookies,
      payload: 'Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n',
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('IMPORT_UNSUPPORTED_FORMAT');
    expect(await listTransactions(userId)).toHaveLength(0);
  });

  it('names the bad row and stores none of the file', async () => {
    const app = await buildTestApp();
    const { userId, cookies } = await createSignedInUser(app, 'owner@example.com');
    const header = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #';

    const response = await app.inject({
      method: 'POST',
      url: '/api/imports?account=chase-checking',
      headers: csv,
      cookies,
      payload: `${header}\nDEBIT,09/28/2026,"COFFEE",-4.75,DEBIT_CARD, ,,\nDEBIT,09/29/2026,"TEA",abc,DEBIT_CARD, ,,\n`,
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('IMPORT_INVALID_ROW');
    expect(response.json().error.message).toMatch(/row 3: amount 'abc'/);
    expect(await listTransactions(userId)).toHaveLength(0);
  });

  it('rejects a body that is not text/csv with 415', async () => {
    const app = await buildTestApp();
    const { cookies } = await createSignedInUser(app, 'owner@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/imports?account=chase-checking',
      headers: { 'content-type': 'application/pdf' },
      cookies,
      payload: 'not a csv',
    });

    expect(response.statusCode).toBe(415);
    expect(response.json().error.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a file over the size limit with 413', async () => {
    const app = await buildTestApp();
    const { cookies } = await createSignedInUser(app, 'owner@example.com');

    const response = await app.inject({
      method: 'POST',
      url: '/api/imports?account=chase-checking',
      headers: csv,
      cookies,
      payload: 'x'.repeat(6 * 1024 * 1024),
    });

    expect(response.statusCode).toBe(413);
    expect(response.json().error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
