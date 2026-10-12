import { useEffect, useState } from 'react';
import type { SpendingSummary } from '../../domain/summary.js';
import { fetchSummary } from '../api/ledger.js';
import { ApiError } from '../api/request.js';
import { useSession } from './useSession.js';

export type SummaryState =
  | { status: 'loading' }
  | { status: 'ready'; summary: SpendingSummary }
  | { status: 'error'; errorCode: string };

type Settled = { key: string; state: SummaryState };

/** Loads the spending summary for a range; pass null while the range is not valid. */
export function useSummary(range: { from: string; to: string } | null) {
  const { expire } = useSession();
  const [settled, setSettled] = useState<Settled | null>(null);
  const [attempt, setAttempt] = useState(0);
  const from = range?.from;
  const to = range?.to;
  const key = `${from}|${to}|${attempt}`;

  useEffect(() => {
    if (!from || !to) return;
    let current = true;
    fetchSummary({ from, to }).then(
      (summary) => {
        if (current) setSettled({ key, state: { status: 'ready', summary } });
      },
      (error: unknown) => {
        if (!current) return;
        if (error instanceof ApiError && error.code === 'AUTH_REQUIRED') expire();
        const errorCode = error instanceof ApiError ? error.code : 'UNKNOWN';
        setSettled({ key, state: { status: 'error', errorCode } });
      },
    );
    return () => {
      current = false;
    };
  }, [from, to, attempt, key, expire]);

  // Whatever has not settled for the current range and attempt is, by definition, loading.
  const state: SummaryState = settled?.key === key ? settled.state : { status: 'loading' };
  return { state, retry: () => setAttempt((n) => n + 1) };
}
