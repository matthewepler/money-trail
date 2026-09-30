import { pool } from '../db/client.js';
import type { StoredTransaction, Transaction } from '../domain/transaction.js';

export type NewTransaction = Transaction & { category: string | null };

type TransactionRow = {
  id: string;
  date: string;
  description: string;
  amount_cents: number;
  account: string;
  category: string | null;
};

function toStoredTransaction(row: TransactionRow): StoredTransaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    amountCents: row.amount_cents,
    account: row.account,
    category: row.category,
  };
}

export async function insertTransactions(
  userId: string,
  transactions: NewTransaction[],
): Promise<StoredTransaction[]> {
  if (transactions.length === 0) return [];

  const result = await pool.query<TransactionRow>(
    `INSERT INTO transactions (user_id, date, description, amount_cents, account, category)
     SELECT $1, * FROM unnest($2::date[], $3::text[], $4::int[], $5::text[], $6::text[])
     RETURNING id, date::text AS date, description, amount_cents, account, category`,
    [
      userId,
      transactions.map((t) => t.date),
      transactions.map((t) => t.description),
      transactions.map((t) => t.amountCents),
      transactions.map((t) => t.account),
      transactions.map((t) => t.category),
    ],
  );

  return result.rows.map(toStoredTransaction);
}

export async function listTransactions(
  userId: string,
  options: { from?: string; to?: string } = {},
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

  const result = await pool.query<TransactionRow>(
    `SELECT id, date::text AS date, description, amount_cents, account, category
     FROM transactions
     WHERE ${conditions.join(' AND ')}
     ORDER BY date DESC, id DESC`,
    params,
  );

  return result.rows.map(toStoredTransaction);
}

export async function summarizeByCategory(
  userId: string,
  from: string,
  to: string,
): Promise<{ category: string | null; totalCents: number }[]> {
  const result = await pool.query<{ category: string | null; total_cents: string }>(
    `SELECT category, SUM(amount_cents) AS total_cents
     FROM transactions
     WHERE user_id = $1 AND date >= $2 AND date <= $3
     GROUP BY category`,
    [userId, from, to],
  );

  return result.rows.map((row) => ({
    category: row.category,
    totalCents: Number(row.total_cents),
  }));
}
