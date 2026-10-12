import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { ImportError } from '../../src/domain/errors.js';
import {
  insertTransactions,
  listTransactions,
} from '../../src/repositories/transactionRepository.js';
import { importChaseCsv } from '../../src/services/importer.js';
import { insertTestUser, truncateAll } from '../helpers/db.js';

const fixture = readFileSync(path.resolve(process.cwd(), 'fixtures/chase-checking.csv'), 'utf8');

beforeEach(async () => {
  await truncateAll();
});

describe('importChaseCsv against Postgres', () => {
  it('stores the categorized ledger, keeping identical same-day rows distinct', async () => {
    const userId = await insertTestUser('owner@example.com');

    const result = await importChaseCsv({ insertTransactions }, userId, {
      text: fixture,
      account: 'chase-checking',
    });

    expect(result).toEqual({ imported: 8, uncategorized: 2 });

    const stored = await listTransactions(userId);
    expect(stored).toHaveLength(8);

    const bakery = stored.filter((t) => t.description.includes('CORNER BAKERY'));
    expect(bakery.map((t) => t.occurrenceIndex).sort()).toEqual([1, 2]);
    expect(bakery.every((t) => t.category === 'FOOD_AND_DRINK')).toBe(true);
    expect(bakery.every((t) => t.source === 'chase-csv')).toBe(true);

    const payroll = stored.find((t) => t.description.includes('PAYROLL'));
    expect(payroll).toMatchObject({ amountCents: 245000, category: 'INCOME' });
  });

  it('leaves the ledger untouched when the file is rejected', async () => {
    const userId = await insertTestUser('owner@example.com');
    const text = 'Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n';

    await expect(
      importChaseCsv({ insertTransactions }, userId, { text, account: 'a' }),
    ).rejects.toThrow(ImportError);

    expect(await listTransactions(userId)).toHaveLength(0);
  });

  it('does not show one user’s import to another', async () => {
    const ownerId = await insertTestUser('owner@example.com');
    const otherId = await insertTestUser('other@example.com');

    await importChaseCsv({ insertTransactions }, ownerId, { text: fixture, account: 'a' });

    expect(await listTransactions(otherId)).toHaveLength(0);
  });
});
