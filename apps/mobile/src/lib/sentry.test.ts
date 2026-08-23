import type { ErrorEvent } from '@sentry/react-native';
import { scrubSentryEvent } from './sentry';

// scrubSentryEvent is a pure data transform and never touches either of
// these at call time; mocked purely to keep this test out of Expo/Sentry's
// native module resolution, which isn't relevant to what's under test.
// jest.mock calls are hoisted above the imports above by Jest's transform
// regardless of source order, so this still applies before ./sentry loads.
jest.mock('expo-constants', () => ({ default: { expoConfig: { version: '0.0.0-test' } } }));
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (c: unknown) => c,
  setUser: jest.fn(),
}));

describe('scrubSentryEvent', () => {
  it('redacts sensitive headers', () => {
    const event = {
      request: {
        headers: {
          Authorization: 'Bearer real-jwt-value',
          Cookie: 'session=real-session-value',
          'Content-Type': 'application/json',
        },
      },
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);

    expect(scrubbed.request?.headers?.Authorization).toBe('[Redacted]');
    expect(scrubbed.request?.headers?.Cookie).toBe('[Redacted]');
    expect(scrubbed.request?.headers?.['Content-Type']).toBe('application/json');
  });

  it('redacts sensitive fields in request data, recursively', () => {
    const event = {
      request: {
        data: {
          email: 'athlete@example.com',
          password: 'super-secret-password',
          session: { access_token: 'real-access-token', note: 'keep me' },
        },
      },
    } as unknown as ErrorEvent;

    const scrubbed = scrubSentryEvent(event);
    const data = scrubbed.request?.data as Record<string, unknown>;
    const session = data.session as Record<string, unknown>;

    expect(data.email).toBe('athlete@example.com');
    expect(data.password).toBe('[Redacted]');
    expect(session.access_token).toBe('[Redacted]');
    expect(session.note).toBe('keep me');
  });

  it('passes events with no request data through unchanged', () => {
    const event = { message: 'something happened' } as unknown as ErrorEvent;
    expect(scrubSentryEvent(event)).toEqual(event);
  });
});
