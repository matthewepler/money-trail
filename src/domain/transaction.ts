import { ValidationError } from './errors.js';

export type Transaction = {
  /** ISO 8601 date, YYYY-MM-DD. */
  date: string;
  description: string;
  /** Integer cents. Negative is money out, positive is money in. */
  amountCents: number;
  account: string;
};

/** What the client is shown of a stored transaction — no identity internals. */
export type TransactionView = Pick<
  StoredTransaction,
  'id' | 'date' | 'description' | 'amountCents' | 'account' | 'category'
>;

/** A transaction after it has been categorized and persisted. */
export type StoredTransaction = Transaction & {
  id: string;
  category: string | null;
  /** Where this row came from, e.g. 'chase-csv' or 'plaid'. */
  source: string;
  /** The provider's own id for this transaction (v4+ only; null for file imports). */
  externalId: string | null;
  /**
   * Distinguishes otherwise-identical rows (same source, account, date, amount,
   * description) imported together — e.g. two identical same-day coffees. See ADR-0006.
   */
  occurrenceIndex: number;
};

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isRealCalendarDate(date: string): boolean {
  const match = ISO_DATE_PATTERN.exec(date);
  if (!match) return false;

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function createTransaction(input: {
  date: string;
  description: string;
  amountCents: number;
  account: string;
}): Transaction {
  if (!isRealCalendarDate(input.date)) {
    throw new ValidationError(`date '${input.date}' is not a valid ISO date (YYYY-MM-DD)`);
  }

  if (!Number.isInteger(input.amountCents)) {
    throw new ValidationError(`amount '${input.amountCents}' is not an integer number of cents`);
  }

  if (input.description.trim() === '') {
    throw new ValidationError('description must not be empty');
  }

  if (input.account.trim() === '') {
    throw new ValidationError('account must not be empty');
  }

  return {
    date: input.date,
    description: input.description,
    amountCents: input.amountCents,
    account: input.account,
  };
}
