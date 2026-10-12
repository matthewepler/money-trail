import type { FastifyInstance } from 'fastify';
import { listTransactionPage } from '../../services/transactionList.js';
import type { RouteDeps } from './index.js';
import { readOptionalDateRange, readPage } from './query.js';

export function transactionRoutes(scope: FastifyInstance, deps: RouteDeps): void {
  scope.get('/api/transactions', async (request) => {
    const range = readOptionalDateRange(request.query);
    const page = readPage(request.query);
    return {
      data: await listTransactionPage(deps.transactionList, request.userId, { ...range, ...page }),
    };
  });
}
