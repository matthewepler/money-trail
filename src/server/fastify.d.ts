import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by the session guard from the cookie — never from the body, query, or path. */
    userId: string;
  }
}
