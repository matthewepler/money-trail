import { describe, expect, it } from 'vitest';
import type { StoredTransaction } from '../domain/transaction.js';
import { listTransactionPage } from './transactionList.js';

function stored(n: number): StoredTransaction {
  return {
    id: `id-${n}`,
    date: '2026-09-28',
    description: `ROW ${n}`,
    amountCents: -n,
    account: 'chase-checking',
    category: 'FOOD_AND_DRINK',
    source: 'chase-csv',
    externalId: null,
    occurrenceIndex: 1,
  };
}

function fakeRepository(total: number) {
  const calls: { userId: string; options: object }[] = [];
  const listTransactions = async (
    userId: string,
    options: { from?: string; to?: string; limit?: number; offset?: number } = {},
  ) => {
    calls.push({ userId, options });
    const all = Array.from({ length: total }, (_, i) => stored(i));
    return all.slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? total));
  };
  return { calls, listTransactions };
}

describe('listTransactionPage', () => {
  it('returns a full page and the offset of the next one when more rows remain', async () => {
    const { listTransactions } = fakeRepository(10);

    const page = await listTransactionPage({ listTransactions }, 'user-1', { limit: 4, offset: 0 });

    expect(page.transactions).toHaveLength(4);
    expect(page.nextOffset).toBe(4);
  });

  it('has no next page when the last row fits exactly', async () => {
    const { listTransactions } = fakeRepository(4);

    const page = await listTransactionPage({ listTransactions }, 'user-1', { limit: 4, offset: 0 });

    expect(page.transactions).toHaveLength(4);
    expect(page.nextOffset).toBeNull();
  });

  it('returns a short final page with no next page', async () => {
    const { listTransactions } = fakeRepository(10);

    const page = await listTransactionPage({ listTransactions }, 'user-1', { limit: 4, offset: 8 });

    expect(page.transactions).toHaveLength(2);
    expect(page.nextOffset).toBeNull();
  });

  it('returns an empty page for an empty ledger', async () => {
    const { listTransactions } = fakeRepository(0);

    expect(
      await listTransactionPage({ listTransactions }, 'user-1', { limit: 4, offset: 0 }),
    ).toEqual({ transactions: [], nextOffset: null });
  });

  it('asks the repository for one extra row, scoped to the user, and passes the filters on', async () => {
    const { calls, listTransactions } = fakeRepository(10);

    await listTransactionPage({ listTransactions }, 'user-1', {
      from: '2026-09-01',
      to: '2026-09-30',
      limit: 4,
      offset: 4,
    });

    expect(calls).toEqual([
      { userId: 'user-1', options: { from: '2026-09-01', to: '2026-09-30', limit: 5, offset: 4 } },
    ]);
  });

  it('hands back only the fields the client needs', async () => {
    const { listTransactions } = fakeRepository(1);

    const page = await listTransactionPage({ listTransactions }, 'user-1', { limit: 4, offset: 0 });

    expect(Object.keys(page.transactions[0] ?? {}).sort()).toEqual([
      'account',
      'amountCents',
      'category',
      'date',
      'description',
      'id',
    ]);
  });
});
