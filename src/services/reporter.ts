import type { Category } from '../domain/category.js';
import type { SpendingSummary } from '../domain/summary.js';
import type { CategoryTotal } from '../repositories/transactionRepository.js';

export type { CategoryTotal };

export type SummaryDeps = {
  sumByCategoryAndDirection: (userId: string, from: string, to: string) => Promise<CategoryTotal[]>;
};

// Not spending (ADR-0011): income, loan and card payments belong to the cash-flow view, and
// transfers are reported separately. Any other category — including one Plaid adds later and
// we store verbatim — counts as spending.
const NOT_SPENDING: ReadonlySet<string> = new Set<Category>([
  'INCOME',
  'LOAN_PAYMENTS',
  'TRANSFER_IN',
  'TRANSFER_OUT',
]);

export function buildSpendingSummary(rows: readonly CategoryTotal[]): SpendingSummary {
  const totals = new Map<string | null, number>();
  let transfersOut = 0;

  for (const row of rows) {
    if (row.category === 'TRANSFER_OUT') {
      transfersOut += row.totalCents;
    } else if (row.category === null) {
      // Uncategorized money out is spending we can't name yet; money in is not spending.
      if (row.direction === 'out') totals.set(null, (totals.get(null) ?? 0) + row.totalCents);
    } else if (!NOT_SPENDING.has(row.category)) {
      // In and out are summed together so a refund nets against its own category.
      totals.set(row.category, (totals.get(row.category) ?? 0) + row.totalCents);
    }
  }

  const categories = [...totals]
    .filter(([, totalCents]) => totalCents !== 0)
    .map(([category, totalCents]) => ({ category, totalCents }))
    .sort((a, b) => a.totalCents - b.totalCents);

  return {
    categories,
    totalCents: categories.reduce((sum, c) => sum + c.totalCents, 0),
    transfersOut: { totalCents: transfersOut },
  };
}

export async function getSpendingSummary(
  deps: SummaryDeps,
  userId: string,
  range: { from: string; to: string },
): Promise<SpendingSummary> {
  return buildSpendingSummary(await deps.sumByCategoryAndDirection(userId, range.from, range.to));
}
