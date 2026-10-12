import controls from '../styles/controls.module.css';
import styles from './DateRangeFields.module.css';

type Props = {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
};

export function DateRangeFields({ from, to, onChange }: Props) {
  return (
    <div className={styles.fields}>
      <div className={controls.field}>
        <label htmlFor="range-from">From</label>
        <input
          id="range-from"
          className={controls.input}
          type="date"
          value={from}
          onChange={(event) => onChange({ from: event.target.value, to })}
        />
      </div>
      <div className={controls.field}>
        <label htmlFor="range-to">To</label>
        <input
          id="range-to"
          className={controls.input}
          type="date"
          value={to}
          onChange={(event) => onChange({ from, to: event.target.value })}
        />
      </div>
    </div>
  );
}
