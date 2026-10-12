import Fastify, { type FastifyInstance } from 'fastify';
import { toHttpError } from './errorHandler.js';

const DEFAULT_BODY_LIMIT_BYTES = 1024 * 1024;

export function buildApp(options: { logger?: boolean; bodyLimit?: number } = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: options.bodyLimit ?? DEFAULT_BODY_LIMIT_BYTES,
  });

  app.setErrorHandler((error, request, reply) => {
    const { status, body } = toHttpError(error);
    if (status >= 500) request.log.error(error);
    return reply.status(status).send(body);
  });

  app.setNotFoundHandler((_request, reply) =>
    reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Route not found' } }),
  );

  return app;
}
