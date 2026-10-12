import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importCsv } from '../api/ledger.js';
import { ApiError } from '../api/request.js';
import { renderWithSession } from '../testing/renderWithSession.js';
import { ImportForm } from './ImportForm.js';

vi.mock('../api/ledger.js');

const CSV = 'Details,Posting Date\nDEBIT,09/28/2026\n';

function chooseFile(content = CSV) {
  const input = screen.getByLabelText('CSV file');
  fireEvent.change(input, {
    target: { files: [new File([content], 'activity.csv', { type: 'text/csv' })] },
  });
}

function openAndSubmit() {
  fireEvent.click(screen.getByRole('button', { name: 'Import' }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ImportForm', () => {
  it('sends the file’s text with the account name, reports the result, and tells the list to refresh', async () => {
    vi.mocked(importCsv).mockResolvedValue({ imported: 8, uncategorized: 2 });
    const onImported = vi.fn();
    renderWithSession(<ImportForm onImported={onImported} />);

    chooseFile();
    openAndSubmit();

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Imported 8 transactions. 2 need a category.',
    );
    expect(importCsv).toHaveBeenCalledWith(CSV, 'Chase checking');
    expect(onImported).toHaveBeenCalledTimes(1);
  });

  it('uses the account name the user typed', async () => {
    vi.mocked(importCsv).mockResolvedValue({ imported: 1, uncategorized: 0 });
    renderWithSession(<ImportForm onImported={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('Account name'), {
      target: { value: 'Joint checking' },
    });
    chooseFile();
    openAndSubmit();

    await waitFor(() => expect(importCsv).toHaveBeenCalledWith(CSV, 'Joint checking'));
    expect(await screen.findByRole('status')).toHaveTextContent('Imported 1 transaction.');
  });

  it('asks for a file, and an account name, before calling the server', () => {
    renderWithSession(<ImportForm onImported={vi.fn()} />);

    openAndSubmit();
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a CSV file.');

    chooseFile();
    fireEvent.change(screen.getByLabelText('Account name'), { target: { value: '  ' } });
    openAndSubmit();
    expect(screen.getByRole('alert')).toHaveTextContent('Enter an account name.');
    expect(importCsv).not.toHaveBeenCalled();
  });

  it('shows the server’s row message when a row is bad, since it says what to fix', async () => {
    vi.mocked(importCsv).mockRejectedValue(
      new ApiError('IMPORT_INVALID_ROW', "row 3: amount 'abc' is not a plain decimal number", 422),
    );
    renderWithSession(<ImportForm onImported={vi.fn()} />);

    chooseFile();
    openAndSubmit();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "row 3: amount 'abc' is not a plain decimal number",
    );
  });

  it.each([
    ['IMPORT_UNSUPPORTED_FORMAT', /isn.t a Chase checking export/i],
    ['IMPORT_MALFORMED_FILE', /couldn.t be read as a CSV/i],
    ['PAYLOAD_TOO_LARGE', /too large.*5 MB/i],
    ['UNSUPPORTED_MEDIA_TYPE', /something went wrong/i],
    ['NETWORK_ERROR', /can.t reach the server/i],
  ])('words a %s failure in our own terms', async (code, expected) => {
    vi.mocked(importCsv).mockRejectedValue(new ApiError(code, 'server wording', 400));
    renderWithSession(<ImportForm onImported={vi.fn()} />);

    chooseFile();
    openAndSubmit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(expected);
    expect(alert).not.toHaveTextContent('server wording');
  });

  it('ends the session if the server says it has expired', async () => {
    vi.mocked(importCsv).mockRejectedValue(new ApiError('AUTH_REQUIRED', 'Sign in required', 401));
    const { session } = renderWithSession(<ImportForm onImported={vi.fn()} />);

    chooseFile();
    openAndSubmit();

    await waitFor(() => expect(session.expire).toHaveBeenCalled());
  });

  it('cannot be submitted again while an import is in flight', async () => {
    vi.mocked(importCsv).mockReturnValue(new Promise(() => {}));
    renderWithSession(<ImportForm onImported={vi.fn()} />);

    chooseFile();
    openAndSubmit();

    expect(await screen.findByRole('button', { name: 'Importing…' })).toBeDisabled();
  });
});
