import type { TransactionView } from '../../domain/transaction.js';
import { categoryLabel } from '../categoryLabels.js';
import { formatDate, formatMoney } from '../format.js';
import styles from './TransactionRow.module.css';

export function TransactionRow({ transaction }: { transaction: TransactionView }) {
  const { description, date, account, category, amountCents } = transaction;
  return (
    <li className={styles.row}>
      <div className={styles.text}>
        <span className={styles.description}>{description}</span>
        <span className={styles.meta}>
          {formatDate(date)} · {account} · {categoryLabel(category)}
        </span>
      </div>
      <span className={amountCents < 0 ? styles.out : styles.in}>
        {formatMoney(amountCents, { signed: true })}
      </span>
    </li>
  );
}
