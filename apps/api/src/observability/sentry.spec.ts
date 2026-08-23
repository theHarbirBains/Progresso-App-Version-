import type { ErrorEvent } from '@sentry/node';
import { scrubSentryEvent } from './sentry';

describe('scrubSentryEvent', () => {
  it('redacts sensitive headers', () => {
    const event = {
      request: {
        headers: {
          Authorization: 'Bearer real-jwt-value',
          Cookie: 'session=real-session-value',
          'X-Api-Key': 'real-api-key',
          'Content-Type': 'application/json',
        },
      },
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.headers?.Authorization).toBe('[Redacted]');
    expect(scrubbed.request?.headers?.Cookie).toBe('[Redacted]');
    expect(scrubbed.request?.headers?.['X-Api-Key']).toBe('[Redacted]');
    expect(scrubbed.request?.headers?.['Content-Type']).toBe('application/json');
  });

  it('redacts sensitive fields in request body data, recursively', () => {
    const event = {
      request: {
        data: {
          email: 'athlete@example.com',
          password: 'super-secret-password',
          nested: {
            refresh_token: 'real-refresh-token',
            service_role_key: 'real-service-role-key',
            note: 'keep me',
          },
        },
      },
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);
    const data = scrubbed.request?.data as Record<string, unknown>;
    const nested = data.nested as Record<string, unknown>;

    expect(data.email).toBe('athlete@example.com');
    expect(data.password).toBe('[Redacted]');
    expect(nested.refresh_token).toBe('[Redacted]');
    expect(nested.service_role_key).toBe('[Redacted]');
    expect(nested.note).toBe('keep me');
  });

  it('redacts sensitive keys inside arrays', () => {
    const event = {
      request: {
        data: { items: [{ token: 'real-token' }, { note: 'keep me' }] },
      },
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);
    const items = (scrubbed.request?.data as { items: Record<string, unknown>[] }).items;

    expect(items[0]?.token).toBe('[Redacted]');
    expect(items[1]?.note).toBe('keep me');
  });

  it('passes events with no request data through unchanged', () => {
    const event = { message: 'something happened' } as unknown as ErrorEvent;
    expect(scrubSentryEvent(event)).toEqual(event);
  });
});
