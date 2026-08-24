import * as Sentry from '@sentry/node';

const SENSITIVE_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'x-api-key',
]);

const SENSITIVE_BODY_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'apikey',
  'api_key',
  'service_role',
  'service_role_key',
  'secret',
  'authorization',
]);

const REDACTED = '[Redacted]';

/**
 * Error tracking only — no performance tracing, no session capture beyond
 * user id. A no-op when dsn is empty, so local dev/CI never send anything
 * unless explicitly configured.
 *
 * Takes its config as explicit parameters rather than reading process.env
 * itself: @nestjs/config only assigns *validated* keys onto process.env
 * (see ConfigModule's `validate` option), which doesn't happen until
 * NestFactory.create() resolves ConfigModule — so this must be called
 * after that, using values read from ConfigService, not before it.
 */
export function initSentry(dsn: string, environment: string): void {
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
  });
}

/**
 * Defense-in-depth beyond Sentry's own default header scrubbing: strips
 * auth headers and common credential/secret field names from request data
 * before an event ever leaves the process.
 */
export function scrubSentryEvent(event: Sentry.ErrorEvent): Sentry.ErrorEvent {
  if (event.request?.headers) {
    for (const key of Object.keys(event.request.headers)) {
      if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {
        event.request.headers[key] = REDACTED;
      }
    }
  }

  if (event.request?.data !== undefined) {
    event.request.data = redactSensitiveKeys(event.request.data);
  }

  return event;
}

function redactSensitiveKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSensitiveKeys);
  }

  if (value && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SENSITIVE_BODY_KEYS.has(key.toLowerCase())
        ? REDACTED
        : redactSensitiveKeys(val);
    }
    return result;
  }

  return value;
}
