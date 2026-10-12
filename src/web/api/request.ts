/** A failed API call. The UI branches on `code`, never on the message text. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  query?: Record<string, string | number | undefined>;
  json?: unknown;
  text?: { content: string; contentType: string };
};

function buildUrl(path: string, query: RequestOptions['query']): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, String(value));
  }
  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function buildInit(options: RequestOptions): RequestInit {
  const init: RequestInit = { method: options.method ?? 'GET', credentials: 'same-origin' };
  if (options.json !== undefined) {
    init.headers = { 'content-type': 'application/json' };
    init.body = JSON.stringify(options.json);
  } else if (options.text) {
    init.headers = { 'content-type': options.text.contentType };
    init.body = options.text.content;
  }
  return init;
}

async function send(path: string, options: RequestOptions): Promise<Response> {
  try {
    return await fetch(buildUrl(path, options.query), buildInit(options));
  } catch (cause) {
    throw new ApiError('NETWORK_ERROR', 'Could not reach the server. Check your connection.', 0, {
      cause,
    });
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch (cause) {
    throw badResponse(response.status, { cause });
  }
}

function badResponse(status: number, options?: ErrorOptions): ApiError {
  return new ApiError('BAD_RESPONSE', 'The server sent an unexpected response.', status, options);
}

function errorFrom(response: Response, payload: unknown): ApiError {
  const error = (payload as { error?: { code?: unknown; message?: unknown } } | null)?.error;
  if (typeof error?.code === 'string' && typeof error.message === 'string') {
    return new ApiError(error.code, error.message, response.status);
  }
  return badResponse(response.status);
}

/** Calls the API and returns the `data` of its `{ data }` envelope. */
export async function requestData<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  const payload = await readJson(response);
  if (!response.ok) throw errorFrom(response, payload);
  if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
    throw badResponse(response.status);
  }
  return payload.data as T;
}

/** For calls that answer 204 No Content. */
export async function requestEmpty(path: string, options: RequestOptions = {}): Promise<void> {
  const response = await send(path, options);
  if (!response.ok) throw errorFrom(response, await readJson(response));
}
