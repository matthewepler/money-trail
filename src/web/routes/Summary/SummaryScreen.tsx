import { useState } from 'react';
import { CategoryRow } from '../../components/CategoryRow.js';
import { DateRangeFields } from '../../components/DateRangeFields.js';
import { categoryLabel } from '../../categoryLabels.js';
import { currentMonthRange } from '../../dateRange.js';
import { formatSpend } from '../../format.js';
import { useSummary } from '../../hooks/useSummary.js';
import controls from '../../styles/controls.module.css';
import styles from './SummaryScreen.module.css';

function rangeProblem(from: string, to: string): string | null {
  if (!from || !to) return 'Choose both dates.';
  if (from > to) return 'Choose a start date on or before the end date.';
  return null;
}

export function SummaryScreen() {
  const [range, setRange] = useState(() => currentMonthRange(new Date()));
  const problem = rangeProblem(range.from, range.to);
  const { state, retry } = useSummary(problem ? null : range);

  return (
    <>
      <h1 className={styles.title}>Summary</h1>
      <DateRangeFields from={range.from} to={range.to} onChange={setRange} />

      {problem && (
        <p role="alert" className={controls.error}>
          {problem}
        </p>
      )}

      {!problem && state.status === 'loading' && (
        <p role="status" className={styles.muted}>
          Loading summary…
        </p>
      )}

      {!problem && state.status === 'error' && (
        <div>
          <p role="alert" className={controls.error}>
            {state.errorCode === 'NETWORK_ERROR'
              ? 'Can’t reach the server. Check your connection.'
              : 'Couldn’t load the summary.'}
          </p>
          <button type="button" className={controls.button} onClick={retry}>
            Try again
          </button>
        </div>
      )}

      {!problem && state.status === 'ready' && (
        <>
          <section aria-label="Total spending" className={styles.total}>
            <p className={styles.totalLabel}>Total spending</p>
            <p className={styles.totalAmount}>{formatSpend(state.summary.totalCents)}</p>
          </section>

          {state.summary.categories.length === 0 ? (
            <p className={styles.muted}>No spending in this period.</p>
          ) : (
            <ul className={styles.list}>
              {state.summary.categories.map(({ category, totalCents }) => (
                <CategoryRow
                  key={category ?? 'uncategorized'}
                  label={categoryLabel(category)}
                  amount={formatSpend(totalCents)}
                  share={
                    state.summary.totalCents < 0 ? totalCents / state.summary.totalCents : null
                  }
                />
              ))}
            </ul>
          )}

          {state.summary.transfersOut.totalCents !== 0 && (
            <section aria-label="Transfers out, not matched" className={styles.transfers}>
              <p className={styles.transfersLine}>
                <span>Transfers out (not matched)</span>
                <span>{formatSpend(state.summary.transfersOut.totalCents)}</span>
              </p>
              <p className={styles.muted}>
                Money moved out of your accounts. Not counted in spending until it can be matched to
                a deposit in another account.
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
