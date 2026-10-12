import type * as ApiModule from './api';

// Keeps this test out of Expo/Sentry's native module resolution (not
// relevant to what's under test here) -- same convention as sentry.test.ts.
// jest.mock calls are hoisted above these imports regardless of source
// order, and registered mocks survive the jest.resetModules() calls below.
jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
}));

const originalFetch = global.fetch;
const originalApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

// process.env.EXPO_PUBLIC_API_BASE_URL is read at call time (not module
// load time), so the module can be imported normally and doesn't need to
// be re-required per test — jest's environment doesn't support dynamic
// `import()` without --experimental-vm-modules.
let api: typeof ApiModule;

beforeEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:4000';
  global.fetch = jest.fn();
  jest.resetModules();
  api = jest.requireActual('./api');
});

afterEach(() => {
  process.env.EXPO_PUBLIC_API_BASE_URL = originalApiBaseUrl;
  global.fetch = originalFetch;
});

function mockFetchOnce(status: number, body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

describe('bodyless POST requests', () => {
  it('send no JSON content type, since there is no body to describe', async () => {
    mockFetchOnce(200, { ok: true });

    await api.cancelGroupWorkout('token-123', 'group-1');

    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.headers).not.toHaveProperty('Content-Type');
    expect(init.headers.Authorization).toBe('Bearer token-123');
  });
});

// Shared GET behaviour (auth header, error messages, missing config), shown through one plain GET.
describe('GET requests', () => {
  it('sends a GET with the bearer token and returns the parsed body', async () => {
    const { getTrainerStatus } = api;
    mockFetchOnce(200, { isTrainer: true });

    const result = await getTrainerStatus('token-123');

    expect(result).toEqual({ isTrainer: true });
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:4000/api/v1/trainer/status', {
      headers: {
        Authorization: 'Bearer token-123',
      },
      signal: expect.anything(),
    });
  });

  it('throws with the backend message on a non-OK response', async () => {
    const { getTrainerStatus } = api;
    mockFetchOnce(401, { message: 'Unauthorized' });

    await expect(getTrainerStatus('bad-token')).rejects.toThrow('Unauthorized');
  });

  it('joins array-form validation messages into a single error', async () => {
    const { getTrainerStatus } = api;
    mockFetchOnce(400, { message: ['username must be lowercase', 'username too short'] });

    await expect(getTrainerStatus('token-123')).rejects.toThrow(
      'username must be lowercase, username too short',
    );
  });

  it("extracts the nested message from the backend's exception-filter wrapper shape", async () => {
    const { getTrainerStatus } = api;
    mockFetchOnce(401, {
      statusCode: 401,
      path: '/api/v1/trainer/status',
      timestamp: '2026-08-26T00:00:00Z',
      message: { message: 'Missing bearer token', error: 'Unauthorized', statusCode: 401 },
    });

    await expect(getTrainerStatus('token-123')).rejects.toThrow('Missing bearer token');
  });

  it('falls back to a generic message for an unknown/malformed nested shape', async () => {
    const { getTrainerStatus } = api;
    mockFetchOnce(401, { message: { error: 'Unauthorized', statusCode: 401 } });

    await expect(getTrainerStatus('token-123')).rejects.toThrow('Request failed');
  });

  it('falls back to a generic message when the error body has no message', async () => {
    const { getTrainerStatus } = api;
    mockFetchOnce(500, {});

    await expect(getTrainerStatus('token-123')).rejects.toThrow('Request failed');
  });

  it('falls back to a generic message when the response body is not JSON', async () => {
    const { getTrainerStatus } = api;
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(getTrainerStatus('token-123')).rejects.toThrow('Request failed');
  });

  it('throws a clear error when EXPO_PUBLIC_API_BASE_URL is not set', async () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    const { getTrainerStatus } = api;

    await expect(getTrainerStatus('token-123')).rejects.toThrow('Missing EXPO_PUBLIC_API_BASE_URL');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe('updateMyProfile', () => {
  it('sends a PATCH with the JSON body and bearer token', async () => {
    const { updateMyProfile } = api;
    const profile = {
      id: 'user-1',
      email: 'athlete@example.com',
      role: 'user',
      displayName: 'New Name',
      username: 'newname',
      weightUnit: 'lb',
    };
    mockFetchOnce(200, profile);

    const result = await updateMyProfile('token-123', {
      displayName: 'New Name',
      username: 'newname',
      weightUnit: 'lb',
    });

    expect(result).toEqual(profile);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:4000/api/v1/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ displayName: 'New Name', username: 'newname', weightUnit: 'lb' }),
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123',
      },
      signal: expect.anything(),
    });
  });

  it('throws with the backend message on conflict (duplicate username)', async () => {
    const { updateMyProfile } = api;
    mockFetchOnce(409, { message: 'Username is already taken' });

    await expect(updateMyProfile('token-123', { username: 'taken' })).rejects.toThrow(
      'Username is already taken',
    );
  });
});

describe('getFoodByBarcode', () => {
  it('sends a GET with the URL-encoded barcode and returns the found product', async () => {
    const { getFoodByBarcode } = api;
    const product = {
      id: 'food-2',
      name: 'Oreo Original',
      brand: 'Oreo',
      servingSize: 34,
      servingUnit: 'g',
      calories: 160,
      proteinG: 1.6,
      carbsG: 25,
      fatG: 7,
      provider: 'open_food_facts',
      barcode: '0066721016123',
    };
    mockFetchOnce(200, product);

    const result = await getFoodByBarcode('token-123', '0066721016123');

    expect(result).toEqual(product);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4000/api/v1/foods/barcode/0066721016123',
      {
        headers: {
          Authorization: 'Bearer token-123',
        },
        signal: expect.anything(),
      },
    );
  });

  it('resolves to null (not a thrown error) when the product is not found', async () => {
    const { getFoodByBarcode } = api;
    mockFetchOnce(200, null);

    const result = await getFoodByBarcode('token-123', '0000000000000');

    expect(result).toBeNull();
  });

  it('still throws on a real backend failure', async () => {
    const { getFoodByBarcode } = api;
    mockFetchOnce(500, { message: 'Internal server error' });

    await expect(getFoodByBarcode('token-123', '123')).rejects.toThrow('Internal server error');
  });
});

describe('request timeout and retry', () => {
  // A cold Render instance (see the production startup investigation) never
  // sends a real HTTP response in time -- simulated here as a fetch() that
  // only ever settles when its own AbortSignal fires, the same thing a real
  // timed-out connection looks like from request()'s point of view.
  function neverRespondUntilAborted(_url: string, init: RequestInit) {
    return new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      });
    });
  }

  afterEach(() => {
    jest.useRealTimers();
  });

  it('retries once after a timeout, succeeding once the retry gets a real response', async () => {
    jest.useFakeTimers();
    const { getTrainerStatus } = api;
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockImplementationOnce(neverRespondUntilAborted);
    mockFetchOnce(200, { isTrainer: false });

    const result = getTrainerStatus('token-123');
    await jest.advanceTimersByTimeAsync(15_000); // the first attempt's own timeout fires
    await jest.advanceTimersByTimeAsync(1_000); // the retry delay

    await expect(result).resolves.toEqual({ isTrainer: false });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws a timeout error if the retry times out too, rather than retrying forever', async () => {
    jest.useFakeTimers();
    const { getTrainerStatus } = api;
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockImplementation(neverRespondUntilAborted);

    const result = getTrainerStatus('token-123');
    const assertion = expect(result).rejects.toThrow('Request timed out');
    await jest.advanceTimersByTimeAsync(15_000); // first attempt times out
    await jest.advanceTimersByTimeAsync(1_000); // retry delay
    await jest.advanceTimersByTimeAsync(15_000); // the retry times out too

    await assertion;
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('never retries a real backend error (only a timeout is retried)', async () => {
    const { getTrainerStatus } = api;
    const mockFetch = global.fetch as jest.Mock;
    mockFetchOnce(401, { message: 'Unauthorized' });

    await expect(getTrainerStatus('bad-token')).rejects.toThrow('Unauthorized');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('never repeats a POST that timed out, since the server may still complete it', async () => {
    jest.useFakeTimers();
    const { createGroup } = api;
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockImplementation(neverRespondUntilAborted);

    const result = createGroup('token-123', { name: 'Push Day', workoutId: 'w1' });
    const assertion = expect(result).rejects.toThrow('Request timed out');
    await jest.advanceTimersByTimeAsync(15_000);
    await jest.advanceTimersByTimeAsync(20_000); // long enough for any retry to have started

    await assertion;
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('never repeats a PATCH that timed out', async () => {
    jest.useFakeTimers();
    const { updateMyProfile } = api;
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockImplementation(neverRespondUntilAborted);

    const result = updateMyProfile('token-123', { displayName: 'Sam' });
    const assertion = expect(result).rejects.toThrow('Request timed out');
    await jest.advanceTimersByTimeAsync(15_000);
    await jest.advanceTimersByTimeAsync(20_000);

    await assertion;
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('still retries a DELETE, which is safe to repeat', async () => {
    jest.useFakeTimers();
    const { unregisterPushToken } = api;
    const mockFetch = global.fetch as jest.Mock;
    mockFetch.mockImplementationOnce(neverRespondUntilAborted);
    mockFetchOnce(200, { removed: true });

    const result = unregisterPushToken('token-123', 'ExponentPushToken[test]');
    await jest.advanceTimersByTimeAsync(15_000);
    await jest.advanceTimersByTimeAsync(1_000);

    await expect(result).resolves.toEqual({ removed: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
