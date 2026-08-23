import Constants from 'expo-constants';
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
    release: Constants.expoConfig?.version,
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
