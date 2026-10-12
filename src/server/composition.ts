import { createSession, deleteSession, findSession } from '../repositories/sessionRepository.js';
import {
  insertTransactions,
  listTransactions,
  sumByCategoryAndDirection,
} from '../repositories/transactionRepository.js';
import { findUserByEmail } from '../repositories/userRepository.js';
import { verifyPassword } from '../services/passwords.js';
import type { RouteDeps } from './routes/index.js';

/** The one place real repositories are handed to services. */
export function createAppDeps(): Pick<
  RouteDeps,
  'auth' | 'importer' | 'transactionList' | 'summary'
> {
  return {
    auth: { findUserByEmail, verifyPassword, createSession, findSession, deleteSession },
    importer: { insertTransactions },
    transactionList: { listTransactions },
    summary: { sumByCategoryAndDirection },
  };
}
