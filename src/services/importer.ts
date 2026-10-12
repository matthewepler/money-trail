import { ValidationError } from '../domain/errors.js';
import type { StoredTransaction } from '../domain/transaction.js';
import type { NewTransaction } from '../repositories/transactionRepository.js';
import { parseChaseCsv } from '../parsers/chaseCsv.js';
import { categorize, type CategoryRule } from './categorizer.js';
import { DEFAULT_CATEGORY_RULES } from './categoryRules.js';

export const CHASE_CSV_SOURCE = 'chase-csv';

export type ImporterDeps = {
  insertTransactions: (
    userId: string,
    transactions: NewTransaction[],
  ) => Promise<StoredTransaction[]>;
  rules?: readonly CategoryRule[];
};

export type ImportResult = {
  imported: number;
  /** Rows no rule matched; stored with a null category. */
  uncategorized: number;
};

/**
 * The whole file is parsed and categorized before anything is written, and the write is a
 * single statement, so a bad row rejects the file and leaves the ledger untouched. (Wrapping
 * a multi-step import in a transaction is v2.)
 */
export async function importChaseCsv(
  deps: ImporterDeps,
  userId: string,
  input: { text: string; account: string },
): Promise<ImportResult> {
  if (input.account.trim() === '') {
    throw new ValidationError('account must not be empty');
  }

  const rules = deps.rules ?? DEFAULT_CATEGORY_RULES;
  const transactions: NewTransaction[] = parseChaseCsv(input.text, {
    account: input.account,
  }).map((transaction) => ({
    ...transaction,
    category: categorize(transaction, rules),
    source: CHASE_CSV_SOURCE,
    externalId: null,
  }));

  const stored = await deps.insertTransactions(userId, transactions);

  return {
    imported: stored.length,
    uncategorized: transactions.filter((t) => t.category === null).length,
  };
}
