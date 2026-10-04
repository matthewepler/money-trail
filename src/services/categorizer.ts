import type { Category } from '../domain/category.js';
import type { Transaction } from '../domain/transaction.js';

export type CategoryRule = {
  category: Category;
  /** The rule matches if any one pattern matches the description. */
  patterns: readonly RegExp[];
  /** Restrict the rule to money coming in or going out. Omitted: either, including zero. */
  direction?: 'in' | 'out';
};

function matchesDirection(rule: CategoryRule, amountCents: number): boolean {
  if (!rule.direction) return true;
  return rule.direction === 'in' ? amountCents > 0 : amountCents < 0;
}

/**
 * The first matching rule wins, so order is priority. Returns null — never a catch-all
 * bucket — when nothing matches, so gaps in the rules stay visible (ADR-0005).
 */
export function categorize(
  transaction: Pick<Transaction, 'description' | 'amountCents'>,
  rules: readonly CategoryRule[],
): Category | null {
  for (const rule of rules) {
    if (!matchesDirection(rule, transaction.amountCents)) continue;
    // search() ignores lastIndex, so a stray /g flag can't make results alternate.
    if (rule.patterns.some((pattern) => transaction.description.search(pattern) !== -1)) {
      return rule.category;
    }
  }
  return null;
}
