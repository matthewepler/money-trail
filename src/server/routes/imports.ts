import type { FastifyInstance } from 'fastify';
import { ValidationError } from '../../domain/errors.js';
import { importChaseCsv } from '../../services/importer.js';
import type { RouteDeps } from './index.js';

const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_ACCOUNT_LENGTH = 100;

function readAccount(query: unknown): string {
  const raw =
    typeof query === 'object' && query !== null
      ? (query as { account?: unknown }).account
      : undefined;
  if (typeof raw !== 'string' || raw.trim() === '' || raw.length > MAX_ACCOUNT_LENGTH) {
    throw new ValidationError(`account is required (at most ${MAX_ACCOUNT_LENGTH} characters)`);
  }
  return raw.trim();
}

// The browser reads the chosen file and sends its text as the body, so there is no multipart
// parsing to get wrong, and `account` rides in the query string (it is a label, not a secret).
export function importRoutes(scope: FastifyInstance, deps: RouteDeps): void {
  scope.addContentTypeParser(
    'text/csv',
    { parseAs: 'string', bodyLimit: MAX_IMPORT_BYTES },
    (_request, body, done) => done(null, body),
  );

  scope.post('/api/imports', { bodyLimit: MAX_IMPORT_BYTES }, async (request, reply) => {
    const text = typeof request.body === 'string' ? request.body : '';
    const result = await importChaseCsv(deps.importer, request.userId, {
      text,
      account: readAccount(request.query),
    });
    return reply.status(201).send({ data: result });
  });
}
