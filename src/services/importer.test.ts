import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ImportError, ValidationError } from '../domain/errors.js';
import type { StoredTransaction } from '../domain/transaction.js';
import type { NewTransaction } from '../repositories/transactionRepository.js';
import type { CategoryRule } from './categorizer.js';
import { importChaseCsv } from './importer.js';

const fixture = readFileSync(path.resolve(process.cwd(), 'fixtures/chase-checking.csv'), 'utf8');
const HEADER = 'Details,Posting Date,Description,Amount,Type,Balance,Check or Slip #';

function fakeRepository() {
  const calls: { userId: string; transactions: NewTransaction[] }[] = [];
  const insertTransactions = async (
    userId: string,
    transactions: NewTransaction[],
  ): Promise<StoredTransaction[]> => {
    calls.push({ userId, transactions });
    return transactions.map((t, i) => ({ ...t, id: `id-${i}`, occurrenceIndex: 1 }));
  };
  return { calls, insertTransactions };
}

describe('importChaseCsv', () => {
  it('parses, categorizes, and stores every row for the given user', async () => {
    const { calls, insertTransactions } = fakeRepository();

    const result = await importChaseCsv({ insertTransactions }, 'user-1', {
      text: fixture,
      account: 'chase-checking',
    });

    expect(result).toEqual({ imported: 8, uncategorized: 2 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.userId).toBe('user-1');
    expect(calls[0]?.transactions.map((t) => t.category)).toEqual([
      'FOOD_AND_DRINK',
      'FOOD_AND_DRINK',
      'INCOME',
      null,
      null,
      'TRANSFER_OUT',
      'BANK_FEES',
      'TRANSFER_OUT',
    ]);
  });

  it('marks every row as a chase-csv import with no provider id', async () => {
    const { calls, insertTransactions } = fakeRepository();

    await importChaseCsv({ insertTransactions }, 'user-1', {
      text: fixture,
      account: 'chase-checking',
    });

    for (const transaction of calls[0]?.transactions ?? []) {
      expect(transaction).toMatchObject({
        source: 'chase-csv',
        externalId: null,
        account: 'chase-checking',
      });
    }
  });

  it('uses injected rules instead of the defaults', async () => {
    const { calls, insertTransactions } = fakeRepository();
    const rules: CategoryRule[] = [{ category: 'MEDICAL', patterns: [/bakery/i] }];

    const result = await importChaseCsv({ insertTransactions, rules }, 'user-1', {
      text: fixture,
      account: 'chase-checking',
    });

    expect(result).toEqual({ imported: 8, uncategorized: 6 });
    expect(calls[0]?.transactions.filter((t) => t.category === 'MEDICAL')).toHaveLength(2);
  });

  it('stores nothing and reports the row when the file has a bad row', async () => {
    const { calls, insertTransactions } = fakeRepository();
    const text = `${HEADER}\nDEBIT,09/28/2026,"COFFEE",-4.75,DEBIT_CARD, ,,\nDEBIT,13/45/2026,"TEA",-3.00,DEBIT_CARD, ,,\n`;

    const attempt = importChaseCsv({ insertTransactions }, 'user-1', { text, account: 'a' });

    await expect(attempt).rejects.toThrow(ImportError);
    await expect(attempt).rejects.toThrow(/row 3/);
    expect(calls).toHaveLength(0);
  });

  it('rejects a blank account label before touching the file', async () => {
    const { calls, insertTransactions } = fakeRepository();

    const attempt = importChaseCsv({ insertTransactions }, 'user-1', {
      text: fixture,
      account: '   ',
    });

    await expect(attempt).rejects.toThrow(ValidationError);
    await expect(attempt).rejects.toThrow(/account/);
    expect(calls).toHaveLength(0);
  });

  it('imports nothing from a header-only file', async () => {
    const { insertTransactions } = fakeRepository();

    const result = await importChaseCsv({ insertTransactions }, 'user-1', {
      text: `${HEADER}\n`,
      account: 'a',
    });

    expect(result).toEqual({ imported: 0, uncategorized: 0 });
  });
});
