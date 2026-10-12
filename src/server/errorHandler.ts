import { ImportError, ValidationError } from '../domain/errors.js';

export type HttpErrorResponse = {
  status: number;
  body: { error: { code: string; message: string } };
};

const CLIENT_ERROR_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
};

function respond(status: number, code: string, message: string): HttpErrorResponse {
  return { status, body: { error: { code, message } } };
}

// Fastify raises its own 4xx errors (malformed JSON, oversized body, wrong content type);
// their messages are written for the client and carry no internals.
function fastifyClientStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('statusCode' in error)) return null;
  const { statusCode } = error;
  return typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500
    ? statusCode
    : null;
}

/** The one place a thrown error becomes an HTTP response. Unknown errors never leak. */
export function toHttpError(error: unknown): HttpErrorResponse {
  if (error instanceof ValidationError) return respond(400, error.code, error.message);
  if (error instanceof ImportError) return respond(422, error.code, error.message);

  const clientStatus = fastifyClientStatus(error);
  if (clientStatus !== null && error instanceof Error) {
    return respond(clientStatus, CLIENT_ERROR_CODES[clientStatus] ?? 'BAD_REQUEST', error.message);
  }

  return respond(500, 'INTERNAL_ERROR', 'Something went wrong');
}
