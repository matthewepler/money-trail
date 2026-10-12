import { ImportForm } from '../../components/ImportForm.js';
import { TransactionRow } from '../../components/TransactionRow.js';
import { useTransactions } from '../../hooks/useTransactions.js';
import controls from '../../styles/controls.module.css';
import styles from './TransactionsScreen.module.css';

export function TransactionsScreen() {
  const ledger = useTransactions();
  const empty = ledger.status === 'ready' && ledger.transactions.length === 0;

  return (
    <>
      <h1 className={styles.title}>Transactions</h1>

      <details className={styles.import} open={empty || undefined}>
        <summary>Import a CSV</summary>
        <ImportForm onImported={ledger.reload} />
      </details>

      {ledger.status === 'loading' && (
        <p role="status" className={styles.muted}>
          Loading transactions…
        </p>
      )}

      {ledger.status === 'error' && (
        <div>
          <p role="alert" className={controls.error}>
            {ledger.errorCode === 'NETWORK_ERROR'
              ? 'Can’t reach the server. Check your connection.'
              : 'Couldn’t load your transactions.'}
          </p>
          <button type="button" className={controls.button} onClick={ledger.reload}>
            Try again
          </button>
        </div>
      )}

      {empty && (
        <p className={styles.muted}>No transactions yet. Import a CSV above to get started.</p>
      )}

      {ledger.transactions.length > 0 && (
        <ul className={styles.list}>
          {ledger.transactions.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </ul>
      )}

      {ledger.loadMoreFailed && (
        <p role="alert" className={controls.error}>
          Couldn’t load more. Check your connection and try again.
        </p>
      )}

      {ledger.hasMore && (
        <button
          type="button"
          className={`${controls.button} ${styles.more}`}
          disabled={ledger.loadingMore}
          onClick={ledger.loadMore}
        >
          {ledger.loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </>
  );
}
