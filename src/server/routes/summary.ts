import type { FastifyInstance } from 'fastify';
import { getSpendingSummary } from '../../services/reporter.js';
import type { RouteDeps } from './index.js';
import { readRequiredDateRange } from './query.js';

export function summaryRoutes(scope: FastifyInstance, deps: RouteDeps): void {
  scope.get('/api/summary', async (request) => ({
    data: await getSpendingSummary(
      deps.summary,
      request.userId,
      readRequiredDateRange(request.query),
    ),
  }));
}
