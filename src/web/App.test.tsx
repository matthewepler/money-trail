import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App.js';
import { fetchTransactions } from './api/ledger.js';
import { ApiError } from './api/request.js';
import { getSessionStatus, signIn, signOut } from './api/session.js';

vi.mock('./api/session.js');
vi.mock('./api/ledger.js');

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function apiError(code: string, status = 400) {
  return new ApiError(code, 'server wording that must never be shown', status);
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchTransactions).mockResolvedValue({ transactions: [], nextOffset: null });
});

describe('session gate and routing', () => {
  it('says it is checking while the session is being looked up', () => {
    vi.mocked(getSessionStatus).mockReturnValue(new Promise(() => {}));

    renderAt('/');

    expect(screen.getByRole('status')).toHaveTextContent(/checking/i);
  });

  it('sends a signed-out visitor to the sign-in screen', async () => {
    vi.mocked(getSessionStatus).mockResolvedValue(false);

    renderAt('/');

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows the app, with navigation, to a signed-in visitor', async () => {
    vi.mocked(getSessionStatus).mockResolvedValue(true);

    renderAt('/');

    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav).toHaveTextContent('Transactions');
    expect(nav).toHaveTextContent('Summary');
  });

  it('moves a signed-in visitor off the sign-in screen', async () => {
    vi.mocked(getSessionStatus).mockResolvedValue(true);

    renderAt('/login');

    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
  });

  it('navigates between the two screens', async () => {
    vi.mocked(getSessionStatus).mockResolvedValue(true);
    renderAt('/');

    fireEvent.click(await screen.findByRole('link', { name: 'Summary' }));

    expect(await screen.findByRole('heading', { name: 'Summary' })).toBeInTheDocument();
  });

  it('reports an unreachable server and lets the user try again', async () => {
    vi.mocked(getSessionStatus).mockRejectedValueOnce(apiError('NETWORK_ERROR', 0));
    vi.mocked(getSessionStatus).mockResolvedValueOnce(true);
    renderAt('/');

    expect(await screen.findByRole('alert')).toHaveTextContent(/can.t reach the server/i);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
  });
});

describe('sign-in screen', () => {
  async function openSignIn() {
    vi.mocked(getSessionStatus).mockResolvedValue(false);
    renderAt('/login');
    await screen.findByRole('heading', { name: 'Sign in' });
  }

  function fillAndSubmit(email: string, password: string) {
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  }

  it('uses the right input types so phone keyboards and password managers behave', async () => {
    await openSignIn();

    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'username');
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'current-password');
  });

  it('signs in with what was typed and lands on the transactions screen', async () => {
    await openSignIn();
    vi.mocked(signIn).mockResolvedValue({ user: { email: 'me@example.com' } });

    fillAndSubmit('me@example.com', 'a-long-password');

    expect(await screen.findByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
    expect(signIn).toHaveBeenCalledWith('me@example.com', 'a-long-password');
  });

  it('shows our own wording for a wrong password, not the server’s', async () => {
    await openSignIn();
    vi.mocked(signIn).mockRejectedValue(apiError('AUTH_INVALID_CREDENTIALS', 401));

    fillAndSubmit('me@example.com', 'nope');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Incorrect email or password.');
    expect(alert).not.toHaveTextContent('server wording');
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('asks for both fields when the server says they are missing', async () => {
    await openSignIn();
    vi.mocked(signIn).mockRejectedValue(apiError('VALIDATION_ERROR'));

    fillAndSubmit('', '');

    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your email and password.');
  });

  it('says so when the server cannot be reached, and for anything unexpected', async () => {
    await openSignIn();
    vi.mocked(signIn).mockRejectedValueOnce(apiError('NETWORK_ERROR', 0));
    fillAndSubmit('me@example.com', 'a-long-password');
    expect(await screen.findByRole('alert')).toHaveTextContent(/can.t reach the server/i);

    vi.mocked(signIn).mockRejectedValueOnce(apiError('INTERNAL_ERROR', 500));
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Try again.'),
    );
  });

  it('cannot be submitted twice while a sign-in is in flight', async () => {
    await openSignIn();
    vi.mocked(signIn).mockReturnValue(new Promise(() => {}));

    fillAndSubmit('me@example.com', 'a-long-password');

    expect(await screen.findByRole('button', { name: 'Signing in…' })).toBeDisabled();
  });
});

describe('signing out', () => {
  it('ends the session and returns to the sign-in screen', async () => {
    vi.mocked(getSessionStatus).mockResolvedValue(true);
    vi.mocked(signOut).mockResolvedValue(undefined);
    renderAt('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(signOut).toHaveBeenCalled();
  });

  it('stays signed in and says so if the server could not end the session', async () => {
    vi.mocked(getSessionStatus).mockResolvedValue(true);
    vi.mocked(signOut).mockRejectedValue(apiError('NETWORK_ERROR', 0));
    renderAt('/');

    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t sign out/i);
    expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument();
  });
});
