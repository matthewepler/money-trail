import type { StoredTransaction, TransactionPage, TransactionView } from '../domain/transaction.js';

export type TransactionListDeps = {
  listTransactions: (
    userId: string,
    options: { from?: string; to?: string; limit?: number; offset?: number },
  ) => Promise<StoredTransaction[]>;
};

function toView(t: StoredTransaction): TransactionView {
  return {
    id: t.id,
    date: t.date,
    description: t.description,
    amountCents: t.amountCents,
    account: t.account,
    category: t.category,
  };
}

export async function listTransactionPage(
  deps: TransactionListDeps,
  userId: string,
  query: { from?: string; to?: string; limit: number; offset: number },
): Promise<TransactionPage> {
  // One row past the page tells us whether another page exists without a COUNT query.
  const rows = await deps.listTransactions(userId, {
    from: query.from,
    to: query.to,
    limit: query.limit + 1,
    offset: query.offset,
  });

  return {
    transactions: rows.slice(0, query.limit).map(toView),
    nextOffset: rows.length > query.limit ? query.offset + query.limit : null,
  };
}
