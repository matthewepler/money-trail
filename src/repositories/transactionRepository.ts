import { pool } from '../db/client.js';
import type { StoredTransaction, Transaction } from '../domain/transaction.js';

export type NewTransaction = Transaction & {
  category: string | null;
  source: string;
  externalId: string | null;
};

type TransactionRow = {
  id: string;
  date: string;
  description: string;
  amount_cents: number;
  account: string;
  category: string | null;
  source: string;
  external_id: string | null;
  occurrence_index: number;
};

function toStoredTransaction(row: TransactionRow): StoredTransaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amountCents: row.amount_cents,
    account: row.account,
    category: row.category,
    source: row.source,
    externalId: row.external_id,
    occurrenceIndex: row.occurrence_index,
  };
}

const SELECT_COLUMNS = `
  id, date::text AS date, description, amount_cents, account, category,
  source, external_id, occurrence_index
`;

/**
 * occurrence_index distinguishes otherwise-identical rows (same source, account, date,
 * amount, description) imported together, e.g. two identical same-day coffees (ADR-0006).
 * It is computed here, against both rows already persisted for this user and duplicates
 * within the current batch, rather than supplied by the caller — assigning it correctly
 * needs visibility into what's already in the database.
 */
export async function insertTransactions(
  userId: string,
  transactions: NewTransaction[],
): Promise<StoredTransaction[]> {
  if (transactions.length === 0) return [];

  const result = await pool.query<TransactionRow>(
    `WITH input AS (
       SELECT
         src.date, src.description, src.amount_cents, src.account, src.category,
         src.source, src.external_id,
         ROW_NUMBER() OVER (
           PARTITION BY src.source, src.account, src.date, src.amount_cents, src.description
           ORDER BY src.ord
         ) AS batch_rank
       FROM unnest($2::date[], $3::text[], $4::int[], $5::text[], $6::text[], $7::text[], $8::text[])
         WITH ORDINALITY AS src(date, description, amount_cents, account, category, source, external_id, ord)
     ),
     existing_counts AS (
       SELECT source, account, date, amount_cents, description, COUNT(*) AS existing_count
       FROM transactions
       WHERE user_id = $1
       GROUP BY source, account, date, amount_cents, description
     )
     INSERT INTO transactions
       (user_id, date, description, amount_cents, account, category, source, external_id, occurrence_index)
     SELECT
       $1, input.date, input.description, input.amount_cents, input.account, input.category,
       input.source, input.external_id,
       COALESCE(existing_counts.existing_count, 0) + input.batch_rank
     FROM input
     LEFT JOIN existing_counts USING (source, account, date, amount_cents, description)
     RETURNING ${SELECT_COLUMNS}`,
    [
      userId,
      transactions.map((t) => t.date),
      transactions.map((t) => t.description),
      transactions.map((t) => t.amountCents),
      transactions.map((t) => t.account),
      transactions.map((t) => t.category),
      transactions.map((t) => t.source),
      transactions.map((t) => t.externalId),
    ],
  );

  return result.rows.map(toStoredTransaction);
}

export async function listTransactions(
  userId: string,
  options: { from?: string; to?: string; limit?: number; offset?: number } = {},
): Promise<StoredTransaction[]> {
  const conditions = ['user_id = $1'];
  const params: unknown[] = [userId];

  if (options.from) {
    params.push(options.from);
    conditions.push(`date >= $${params.length}`);
  }
  if (options.to) {
    params.push(options.to);
    conditions.push(`date <= $${params.length}`);
  }

  // id breaks ties within a date so consecutive pages never repeat or skip a row.
  let pagination = '';
  if (options.limit !== undefined) {
    params.push(options.limit);
    pagination += ` LIMIT $${params.length}`;
  }
  if (options.offset !== undefined) {
    params.push(options.offset);
    pagination += ` OFFSET $${params.length}`;
  }

  const result = await pool.query<TransactionRow>(
    `SELECT ${SELECT_COLUMNS}
     FROM transactions
     WHERE ${conditions.join(' AND ')}
     ORDER BY date DESC, id DESC${pagination}`,
    params,
  );

  return result.rows.map(toStoredTransaction);
}

export type CategoryTotal = {
  category: string | null;
  direction: 'in' | 'out';
  totalCents: number;
};

/**
 * Money in and money out are summed apart, so a caller can tell a refund from spending
 * even inside one category (and ignore uncategorized inflow).
 */
export async function sumByCategoryAndDirection(
  userId: string,
  from: string,
  to: string,
): Promise<CategoryTotal[]> {
  const result = await pool.query<{
    category: string | null;
    direction: 'in' | 'out';
    total_cents: string;
  }>(
    `SELECT category,
            CASE WHEN amount_cents < 0 THEN 'out' ELSE 'in' END AS direction,
            SUM(amount_cents) AS total_cents
     FROM transactions
     WHERE user_id = $1 AND date >= $2 AND date <= $3
     GROUP BY category, direction`,
    [userId, from, to],
  );

  return result.rows.map((row) => ({
    category: row.category,
    direction: row.direction,
    totalCents: Number(row.total_cents),
  }));
}
