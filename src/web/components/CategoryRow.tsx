import styles from './CategoryRow.module.css';

type Props = {
  label: string;
  amount: string;
  /** This category's share of total spending, 0 to 1, or null when there is nothing to compare. */
  share: number | null;
};

const BAR_WIDTH = 100;

export function CategoryRow({ label, amount, share }: Props) {
  return (
    <li className={styles.row}>
      <div className={styles.line}>
        <span>{label}</span>
        <span className={styles.amount}>{amount}</span>
      </div>
      {share !== null && (
        // SVG attributes, not an inline style, so a strict Content-Security-Policy can allow it.
        <svg
          className={styles.bar}
          viewBox={`0 0 ${BAR_WIDTH} 4`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <rect className={styles.track} width={BAR_WIDTH} height="4" />
          <rect
            className={styles.fill}
            width={BAR_WIDTH * Math.min(Math.max(share, 0), 1)}
            height="4"
          />
        </svg>
      )}
    </li>
  );
}
