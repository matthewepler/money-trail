import { useEffect, useState } from 'react';
import type { TransactionView } from '../../domain/transaction.js';
import { fetchTransactions } from '../api/ledger.js';
import { ApiError } from '../api/request.js';
import { useSession } from './useSession.js';

const PAGE_SIZE = 50;

export type TransactionsState = {
  transactions: TransactionView[];
  status: 'loading' | 'ready' | 'error';
  /** The ApiError code when the first page failed to load. */
  errorCode: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  loadMore: () => void;
  /** Start again from the first page, e.g. after an import. */
  reload: () => void;
};

export function useTransactions(): TransactionsState {
  const { expire } = useSession();
  const [transactions, setTransactions] = useState<TransactionView[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [status, setStatus] = useState<TransactionsState['status']>('loading');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let current = true;
    fetchTransactions({ limit: PAGE_SIZE, offset: 0 }).then(
      (page) => {
        if (!current) return;
        setTransactions(page.transactions);
        setNextOffset(page.nextOffset);
        setStatus('ready');
      },
      (error: unknown) => {
        if (!current) return;
        if (error instanceof ApiError && error.code === 'AUTH_REQUIRED') expire();
        setErrorCode(error instanceof ApiError ? error.code : 'UNKNOWN');
        setStatus('error');
      },
    );
    return () => {
      current = false;
    };
  }, [reloadKey, expire]);

  async function loadMore() {
    if (nextOffset === null || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const page = await fetchTransactions({ limit: PAGE_SIZE, offset: nextOffset });
      setTransactions((previous) => [...previous, ...page.transactions]);
      setNextOffset(page.nextOffset);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH_REQUIRED') expire();
      setLoadMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  function reload() {
    setStatus('loading');
    setTransactions([]);
    setNextOffset(null);
    setLoadMoreFailed(false);
    setReloadKey((key) => key + 1);
  }

  return {
    transactions,
    status,
    errorCode,
    hasMore: nextOffset !== null,
    loadingMore,
    loadMoreFailed,
    loadMore: () => void loadMore(),
    reload,
  };
}
