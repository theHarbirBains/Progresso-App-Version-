import * as Sentry from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/react-native';
import { recordApiRequestOutcome, scrubSentryEvent } from './sentry';

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
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
}));

const mockAddBreadcrumb = Sentry.addBreadcrumb as jest.Mock;
const mockCaptureMessage = Sentry.captureMessage as jest.Mock;

beforeEach(() => {
  mockAddBreadcrumb.mockClear();
  mockCaptureMessage.mockClear();
});

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

describe('recordApiRequestOutcome', () => {
  it('records a successful request as an info-level breadcrumb, route only (no query string)', () => {
    recordApiRequestOutcome('/api/v1/foods/search?query=chicken', 'GET', 142, 'ok');

    expect(mockAddBreadcrumb).toHaveBeenCalledWith({
      category: 'api.request',
      message: 'GET /api/v1/foods/search',
      level: 'info',
      data: { durationMs: 142, outcome: 'ok' },
    });
    expect(mockCaptureMessage).not.toHaveBeenCalled();
  });

  it('records a failed request as a warning-level breadcrumb', () => {
    recordApiRequestOutcome('/api/v1/users/me', 'PATCH', 80, 'http_error');

    expect(mockAddBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({ level: 'warning', data: { durationMs: 80, outcome: 'http_error' } }),
    );
  });

  it('also captures a timeout as its own message, since it needs to be visible without a crash to attach a breadcrumb to', () => {
    recordApiRequestOutcome('/api/v1/users/me', 'GET', 15_000, 'timeout');

    expect(mockCaptureMessage).toHaveBeenCalledWith('API request timed out: GET /api/v1/users/me', {
      level: 'warning',
      extra: { durationMs: 15_000 },
    });
  });

  it('never includes the query string, which can hold user-entered search text', () => {
    recordApiRequestOutcome('/api/v1/foods/search?query=something+private', 'GET', 10, 'timeout');

    const breadcrumbCall = mockAddBreadcrumb.mock.calls[0][0];
    const captureCall = mockCaptureMessage.mock.calls[0][0];
    expect(JSON.stringify(breadcrumbCall)).not.toContain('something');
    expect(captureCall).not.toContain('something');
  });
});
