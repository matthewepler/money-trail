import type { SpendingSummary } from '../../domain/summary.js';
import type { ImportResult, TransactionPage } from '../../domain/transaction.js';
import { requestData } from './request.js';

export type TransactionQuery = { from?: string; to?: string; limit?: number; offset?: number };

export function fetchTransactions(query: TransactionQuery = {}): Promise<TransactionPage> {
  return requestData('/api/transactions', { query });
}

export function fetchSummary(range: { from: string; to: string }): Promise<SpendingSummary> {
  return requestData('/api/summary', { query: range });
}

/** Sends the file's text; the server parses it, so a bad row rejects the whole file. */
export function importCsv(content: string, account: string): Promise<ImportResult> {
  return requestData('/api/imports', {
    method: 'POST',
    query: { account },
    text: { content, contentType: 'text/csv' },
  });
}
