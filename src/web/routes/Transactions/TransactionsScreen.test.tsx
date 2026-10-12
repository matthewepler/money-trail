import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TransactionPage, TransactionView } from '../../../domain/transaction.js';
import { fetchTransactions, importCsv } from '../../api/ledger.js';
import { ApiError } from '../../api/request.js';
import { renderWithSession } from '../../testing/renderWithSession.js';
import { TransactionsScreen } from './TransactionsScreen.js';

vi.mock('../../api/ledger.js');

function txn(n: number, overrides: Partial<TransactionView> = {}): TransactionView {
  return {
    id: `id-${n}`,
    date: '2026-09-28',
    description: `PURCHASE ${n}`,
    amountCents: -475,
    account: 'Chase checking',
    category: 'FOOD_AND_DRINK',
    ...overrides,
  };
}

const page = (
  transactions: TransactionView[],
  nextOffset: number | null = null,
): TransactionPage => ({
  transactions,
  nextOffset,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('TransactionsScreen', () => {
  it('shows a loading state, then each transaction readably', async () => {
    vi.mocked(fetchTransactions).mockResolvedValue(page([txn(1)]));
    renderWithSession(<TransactionsScreen />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    const item = await screen.findByRole('listitem');

    expect(within(item).getByText('PURCHASE 1')).toBeInTheDocument();
    expect(item).toHaveTextContent('Sep 28, 2026');
    expect(item).toHaveTextContent('Chase checking');
    expect(item).toHaveTextContent('Food & drink');
    expect(item).toHaveTextContent('-$4.75');
    expect(fetchTransactions).toHaveBeenCalledWith({ limit: 50, offset: 0 });
  });

  it('shows money in with a plus sign and an unmatched category as Uncategorized', async () => {
    vi.mocked(fetchTransactions).mockResolvedValue(
      page([txn(1, { amountCents: 245000, category: null, description: 'ACME PAYROLL' })]),
    );
    renderWithSession(<TransactionsScreen />);

    const item = await screen.findByRole('listitem');

    expect(item).toHaveTextContent('+$2,450.00');
    expect(item).toHaveTextContent('Uncategorized');
  });

  it('points to the import when the ledger is empty', async () => {
    vi.mocked(fetchTransactions).mockResolvedValue(page([]));
    renderWithSession(<TransactionsScreen />);

    expect(await screen.findByText(/no transactions yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('loads the next page on request and appends it, until there is no more', async () => {
    vi.mocked(fetchTransactions)
      .mockResolvedValueOnce(page([txn(1), txn(2)], 50))
      .mockResolvedValueOnce(page([txn(3)], null));
    renderWithSession(<TransactionsScreen />);
    await screen.findAllByRole('listitem');

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
    expect(fetchTransactions).toHaveBeenLastCalledWith({ limit: 50, offset: 50 });
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('offers no "Load more" when everything fit on the first page', async () => {
    vi.mocked(fetchTransactions).mockResolvedValue(page([txn(1)], null));
    renderWithSession(<TransactionsScreen />);
    await screen.findByRole('listitem');

    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
  });

  it('says so when it cannot load, and tries again on request', async () => {
    vi.mocked(fetchTransactions)
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'x', 0))
      .mockResolvedValueOnce(page([txn(1)]));
    renderWithSession(<TransactionsScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/can.t reach the server/i);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('listitem')).toBeInTheDocument();
  });

  it('keeps what is already shown if a later page fails, and lets the user retry it', async () => {
    vi.mocked(fetchTransactions)
      .mockResolvedValueOnce(page([txn(1)], 50))
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'x', 0))
      .mockResolvedValueOnce(page([txn(2)], null));
    renderWithSession(<TransactionsScreen />);
    await screen.findByRole('listitem');

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t load more/i);
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
  });

  it('ends the session if the server says it has expired', async () => {
    vi.mocked(fetchTransactions).mockRejectedValue(new ApiError('AUTH_REQUIRED', 'x', 401));
    const { session } = renderWithSession(<TransactionsScreen />);

    await waitFor(() => expect(session.expire).toHaveBeenCalled());
  });

  it('shows the new rows after an import, and keeps the panel open so the result is visible', async () => {
    vi.mocked(fetchTransactions)
      .mockResolvedValueOnce(page([]))
      .mockResolvedValueOnce(page([txn(1), txn(2)]));
    vi.mocked(importCsv).mockResolvedValue({ imported: 2, uncategorized: 0 });
    const { container } = renderWithSession(<TransactionsScreen />);
    await screen.findByText(/no transactions yet/i);

    fireEvent.change(screen.getByLabelText('CSV file'), {
      target: { files: [new File(['a,b\n'], 'activity.csv', { type: 'text/csv' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import' }));

    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
    expect(fetchTransactions).toHaveBeenLastCalledWith({ limit: 50, offset: 0 });
    // The ledger is no longer empty, but the panel must not collapse over its own result.
    expect(container.querySelector('details')).toHaveAttribute('open');
    expect(screen.getByRole('status')).toHaveTextContent('Imported 2 transactions.');
  });

  it('opens the import panel for an empty ledger, and leaves it closed otherwise', async () => {
    vi.mocked(fetchTransactions).mockResolvedValue(page([txn(1)]));
    const { container } = renderWithSession(<TransactionsScreen />);
    await screen.findByRole('listitem');

    expect(container.querySelector('details')).not.toHaveAttribute('open');
  });
});
