// The one place every backend API module's calls funnel through -- auth
// header, JSON content-type (only when there's a body to describe), and the
// backend's own error-shape unwrapping. Split out of the old monolithic
// api.ts so each domain (profile, exercises, foods, follows, trainer,
// groups, ...) can live in its own file while still sharing this exact
// request/error behavior, rather than each reimplementing it.
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

export async function request<T>(
  path: string,
  accessToken: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      // Only a request with a body is JSON. The API rejects an empty body sent as JSON.
      ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      Authorization: `Bearer ${accessToken}`,
      ...init?.headers,
    },
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(extractErrorMessage(body));
  }

  return body as T;
}
