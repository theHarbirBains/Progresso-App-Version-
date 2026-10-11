import { recordApiRequestOutcome } from './sentry';

// The one place every backend API module's calls funnel through -- auth
// header, JSON content-type (only when there's a body to describe), request
// timeout/retry, and the backend's own error-shape unwrapping. Split out of
// the old monolithic api.ts so each domain (profile, exercises, foods,
// follows, trainer, groups, ...) can live in its own file while still
// sharing this exact request/error behavior, rather than each
// reimplementing it.
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!url) {
    throw new Error(
      'Missing EXPO_PUBLIC_API_BASE_URL. Copy apps/mobile/.env.example to apps/mobile/.env and fill in your backend URL.',
    );
  }
  return url;
}

function extractErrorMessage(body: unknown): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
    // The backend's global exception filter wraps NestJS's own exception
    // response (e.g. { message: 'Missing bearer token', error, statusCode })
    // under this outer message field, so a real error surfaces one level
    // deeper than a plain HttpException response would.
    if (message && typeof message === 'object' && 'message' in message) {
      const nested = (message as { message: unknown }).message;
      if (typeof nested === 'string') return nested;
    }
  }
  return 'Request failed';
}

// Render's free-tier API instance sleeps after inactivity and takes 10s of
// seconds (measured directly against the deployed backend: 71s cold, 0.14s
// warm) to wake on the next request -- long enough to exceed iOS's own
// ~60s default fetch timeout, which is what "the app hangs, then
// sometimes times out" during a cold open actually was. Bounding every
// request client-side instead turns that into a fast, clear, recoverable
// failure. 15s is deliberately shorter than the measured worst-case cold
// start -- the point isn't to wait out a cold start on one attempt, it's
// to fail fast and let the automatic retry below (plus, for a real cold
// start, the screen's own existing Retry affordance) pick it up once the
// instance is actually warm.
const DEFAULT_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 1_000;

/**
 * Thrown when a request is aborted for taking longer than its timeout --
 * distinguished from a real 4xx/5xx the backend actively returned, so only
 * this kind is retried automatically (see request() below), and so a
 * caller could tell "the backend is slow/cold" apart from "the backend
 * said no" if it ever needed to.
 */
export class RequestTimeoutError extends Error {
  constructor() {
    super('Request timed out');
    this.name = 'RequestTimeoutError';
  }
}

async function requestOnce<T>(
  path: string,
  accessToken: string,
  init: RequestInit | undefined,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  const method = init?.method ?? 'GET';

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        // Only a request with a body is JSON. The API rejects an empty body sent as JSON.
        ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${accessToken}`,
        ...init?.headers,
      },
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    recordApiRequestOutcome(
      path,
      method,
      Date.now() - startedAt,
      isAbort ? 'timeout' : 'network_error',
    );
    if (isAbort) throw new RequestTimeoutError();
    throw err;
  } finally {
    clearTimeout(timer);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    recordApiRequestOutcome(path, method, Date.now() - startedAt, 'http_error');
    throw new Error(extractErrorMessage(body));
  }

  recordApiRequestOutcome(path, method, Date.now() - startedAt, 'ok');
  return body as T;
}

/**
 * Every backend API call funnels through here. Each attempt is bounded by
 * `timeoutMs` (default 15s -- pass a longer one for an endpoint that's
 * legitimately slower by nature, e.g. an AI-backed one with its own
 * server-side retries). A timeout specifically -- never a real 4xx/5xx the
 * backend actively returned -- is retried exactly once, after a short
 * delay: that's the signature of a cold instance waking up, not a real
 * failure, so a second attempt a moment later usually lands on one that's
 * now warm. A second timeout (or any other error) propagates as-is, for
 * the caller's own existing error handling/Retry affordance.
 */
export async function request<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
  options?: { timeoutMs?: number },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  try {
    return await requestOnce<T>(path, accessToken, init, timeoutMs);
  } catch (err) {
    if (!(err instanceof RequestTimeoutError)) throw err;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return requestOnce<T>(path, accessToken, init, timeoutMs);
  }
}
