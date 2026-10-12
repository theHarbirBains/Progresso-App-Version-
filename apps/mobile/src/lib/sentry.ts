import * as Sentry from '@sentry/react-native';
import type { ComponentType } from 'react';

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
 * Error tracking only — no performance tracing, no session replay, no
 * screenshots (replay in particular would risk visually capturing the
 * sign-in form's password field). Inert until EXPO_PUBLIC_SENTRY_DSN is
 * set, so local dev never sends anything unless explicitly configured.
 */
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: __DEV__ ? 'development' : 'production',
    // No release override: the SDK's default (bundle id, version and build number, with the build
    // number as dist) tells TestFlight builds apart and matches what the build uploads maps under.
    tracesSampleRate: 0,
    beforeSend: scrubSentryEvent,
  });
}

/**
 * Defense-in-depth beyond Sentry's own default scrubbing: strips auth
 * headers and common credential/secret field names before an event ever
 * leaves the device.
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

/** Wraps the root component for React render-tree error capture. */
export function wrapApp<P extends Record<string, unknown>>(
  component: ComponentType<P>,
): ComponentType<P> {
  return Sentry.wrap(component);
}

/** Associates errors with the authenticated user — id only, never email. */
export function setSentryUser(userId: string): void {
  Sentry.setUser({ id: userId });
}

export function clearSentryUser(): void {
  Sentry.setUser(null);
}

export type ApiRequestOutcome = 'ok' | 'http_error' | 'timeout' | 'network_error';

/**
 * One backend API call's timing/outcome, as a Sentry breadcrumb -- route only (its query
 * string, which can hold user-entered search text, is stripped) and method, never a request/
 * response body or the auth header. Breadcrumbs ride along with the next captured event,
 * giving a timeline of recent requests around any crash/error.
 *
 * A timeout specifically is also captured as its own lightweight message: that's the signal
 * from the production startup investigation (a cold Render instance taking 70+s to wake up,
 * exceeding iOS's own ~60s default fetch timeout) that's worth seeing on its own, in
 * production, without an unrelated crash to attach a breadcrumb to. `tracesSampleRate` stays
 * 0 (see initSentry's own comment) -- this is a handful of lightweight events, not
 * performance tracing.
 */
export function recordApiRequestOutcome(
  path: string,
  method: string,
  durationMs: number,
  outcome: ApiRequestOutcome,
): void {
  const route = path.split('?')[0];
  Sentry.addBreadcrumb({
    category: 'api.request',
    message: `${method} ${route}`,
    level: outcome === 'ok' ? 'info' : 'warning',
    data: { durationMs, outcome },
  });

  if (outcome === 'timeout') {
    Sentry.captureMessage(`API request timed out: ${method} ${route}`, {
      level: 'warning',
      extra: { durationMs },
    });
  }
}
