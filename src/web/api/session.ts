import { ApiError, requestData, requestEmpty } from './request.js';

export function signIn(email: string, password: string): Promise<{ user: { email: string } }> {
  return requestData('/api/session', { method: 'POST', json: { email, password } });
}

export function signOut(): Promise<void> {
  return requestEmpty('/api/session', { method: 'DELETE' });
}

/** True if the browser holds a live session. "Not signed in" is an answer, not an error. */
export async function getSessionStatus(): Promise<boolean> {
  try {
    await requestData('/api/session');
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'AUTH_REQUIRED') return false;
    throw error;
  }
}
