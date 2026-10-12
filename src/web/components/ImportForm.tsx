import { useState, type FormEvent } from 'react';
import type { ImportResult } from '../../domain/transaction.js';
import { importCsv } from '../api/ledger.js';
import { ApiError } from '../api/request.js';
import { useSession } from '../hooks/useSession.js';
import controls from '../styles/controls.module.css';

const DEFAULT_ACCOUNT = 'Chase checking';

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function describe({ imported, uncategorized }: ImportResult): string {
  const base = `Imported ${imported} ${plural(imported, 'transaction', 'transactions')}.`;
  return uncategorized === 0
    ? base
    : `${base} ${uncategorized} ${plural(uncategorized, 'needs', 'need')} a category.`;
}

// A bad-row message names the row and the value, so it is shown as the server wrote it; every
// other failure is worded here, by code.
function failureMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Try again.';
  switch (error.code) {
    case 'IMPORT_INVALID_ROW':
      return error.message;
    case 'IMPORT_UNSUPPORTED_FORMAT':
      return 'That file isn’t a Chase checking export. Download the transactions CSV from your checking account.';
    case 'IMPORT_MALFORMED_FILE':
      return 'That file couldn’t be read as a CSV.';
    case 'PAYLOAD_TOO_LARGE':
      return 'That file is too large (the limit is 5 MB).';
    case 'NETWORK_ERROR':
      return 'Can’t reach the server. Check your connection and try again.';
    default:
      return 'Something went wrong. Try again.';
  }
}

export function ImportForm({ onImported }: { onImported: () => void }) {
  const { expire } = useSession();
  const [account, setAccount] = useState(DEFAULT_ACCOUNT);
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) return setMessage({ kind: 'error', text: 'Choose a CSV file.' });
    if (!account.trim()) return setMessage({ kind: 'error', text: 'Enter an account name.' });

    setPending(true);
    setMessage(null);
    try {
      const result = await importCsv(await file.text(), account.trim());
      setMessage({ kind: 'success', text: describe(result) });
      // Clear the chosen file so it can't be imported twice by accident (re-imports aren't
      // de-duplicated until v2).
      setFile(null);
      setFileKey((key) => key + 1);
      onImported();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'AUTH_REQUIRED') expire();
      setMessage({ kind: 'error', text: failureMessage(error) });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} noValidate>
      <div className={controls.field}>
        <label htmlFor="account">Account name</label>
        <input
          id="account"
          className={controls.input}
          value={account}
          maxLength={100}
          onChange={(event) => setAccount(event.target.value)}
        />
      </div>
      <div className={controls.field}>
        <label htmlFor="csv-file">CSV file</label>
        <input
          key={fileKey}
          id="csv-file"
          className={controls.input}
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </div>
      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={message.kind === 'error' ? controls.error : controls.notice}
        >
          {message.text}
        </p>
      )}
      <button type="submit" className={controls.button} disabled={pending}>
        {pending ? 'Importing…' : 'Import'}
      </button>
    </form>
  );
}
