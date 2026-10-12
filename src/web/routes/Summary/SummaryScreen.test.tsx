import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SpendingSummary } from '../../../domain/summary.js';
import { fetchSummary } from '../../api/ledger.js';
import { ApiError } from '../../api/request.js';
import { renderWithSession } from '../../testing/renderWithSession.js';
import { SummaryScreen } from './SummaryScreen.js';

vi.mock('../../api/ledger.js');

const summary: SpendingSummary = {
  categories: [
    { category: null, totalCents: -14390 },
    { category: 'BANK_FEES', totalCents: -1200 },
    { category: 'FOOD_AND_DRINK', totalCents: -950 },
  ],
  totalCents: -16540,
  transfersOut: { totalCents: -56000 },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 15));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('SummaryScreen', () => {
  it('asks for the current month by default, and says it is loading', () => {
    vi.mocked(fetchSummary).mockReturnValue(new Promise(() => {}));
    renderWithSession(<SummaryScreen />);

    expect(screen.getByLabelText('From')).toHaveValue('2026-10-01');
    expect(screen.getByLabelText('To')).toHaveValue('2026-10-31');
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    expect(fetchSummary).toHaveBeenCalledWith({ from: '2026-10-01', to: '2026-10-31' });
  });

  it('shows total spending as a positive amount, with each category labelled and its spend', async () => {
    vi.mocked(fetchSummary).mockResolvedValue(summary);
    renderWithSession(<SummaryScreen />);

    const total = await screen.findByLabelText('Total spending');
    expect(total).toHaveTextContent('$165.40');

    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Uncategorized');
    expect(rows[0]).toHaveTextContent('$143.90');
    expect(rows[1]).toHaveTextContent('Bank fees');
    expect(rows[1]).toHaveTextContent('$12.00');
    expect(rows[2]).toHaveTextContent('Food & drink');
    expect(rows[2]).toHaveTextContent('$9.50');
  });

  it('keeps transfers out on their own line, explained, and outside the total', async () => {
    vi.mocked(fetchSummary).mockResolvedValue(summary);
    renderWithSession(<SummaryScreen />);

    const transfers = await screen.findByLabelText('Transfers out, not matched');
    expect(transfers).toHaveTextContent('$560.00');
    expect(transfers).toHaveTextContent(/not counted in spending/i);
    expect(within(screen.getByLabelText('Total spending')).queryByText('$560.00')).toBeNull();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('leaves out the transfers line when there are none', async () => {
    vi.mocked(fetchSummary).mockResolvedValue({ ...summary, transfersOut: { totalCents: 0 } });
    renderWithSession(<SummaryScreen />);
    await screen.findByLabelText('Total spending');

    expect(screen.queryByLabelText('Transfers out, not matched')).not.toBeInTheDocument();
  });

  it('says so when nothing was spent in the period', async () => {
    vi.mocked(fetchSummary).mockResolvedValue({
      categories: [],
      totalCents: 0,
      transfersOut: { totalCents: 0 },
    });
    renderWithSession(<SummaryScreen />);

    expect(await screen.findByText(/no spending in this period/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Total spending')).toHaveTextContent('$0.00');
  });

  it('asks again when the range changes', async () => {
    vi.mocked(fetchSummary).mockResolvedValue(summary);
    renderWithSession(<SummaryScreen />);
    await screen.findByLabelText('Total spending');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-01' } });

    await waitFor(() =>
      expect(fetchSummary).toHaveBeenLastCalledWith({ from: '2026-09-01', to: '2026-10-31' }),
    );
  });

  it('does not ask the server for a range that is backwards or incomplete', async () => {
    vi.mocked(fetchSummary).mockResolvedValue(summary);
    renderWithSession(<SummaryScreen />);
    await screen.findByLabelText('Total spending');
    vi.mocked(fetchSummary).mockClear();

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-11-15' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/start date on or before the end date/i);

    fireEvent.change(screen.getByLabelText('To'), { target: { value: '' } });
    expect(screen.getByRole('alert')).toHaveTextContent(/choose both dates/i);
    expect(fetchSummary).not.toHaveBeenCalled();
  });

  it('says so when it cannot load, and tries again on request', async () => {
    vi.mocked(fetchSummary)
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 'x', 0))
      .mockResolvedValueOnce(summary);
    renderWithSession(<SummaryScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/can.t reach the server/i);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByLabelText('Total spending')).toBeInTheDocument();
  });

  it('ends the session if the server says it has expired', async () => {
    vi.mocked(fetchSummary).mockRejectedValue(new ApiError('AUTH_REQUIRED', 'x', 401));
    const { session } = renderWithSession(<SummaryScreen />);

    await waitFor(() => expect(session.expire).toHaveBeenCalled());
  });
});
