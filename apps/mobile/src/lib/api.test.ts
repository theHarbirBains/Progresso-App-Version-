import type * as ApiModule from './api';

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

describe('getMyProfile', () => {
  it('sends a GET with the bearer token and returns the parsed profile', async () => {
    const { getMyProfile } = api;
    const profile = {
      id: 'user-1',
      email: 'athlete@example.com',
      role: 'user',
      displayName: 'Athlete',
      username: 'athlete1',
      weightUnit: 'kg',
    };
    mockFetchOnce(200, profile);

    const result = await getMyProfile('token-123');

    expect(result).toEqual(profile);
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:4000/api/v1/users/me', {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token-123',
      },
    });
  });

  it('throws with the backend message on a non-OK response', async () => {
    const { getMyProfile } = api;
    mockFetchOnce(401, { message: 'Unauthorized' });

    await expect(getMyProfile('bad-token')).rejects.toThrow('Unauthorized');
  });

  it('joins array-form validation messages into a single error', async () => {
    const { getMyProfile } = api;
    mockFetchOnce(400, { message: ['username must be lowercase', 'username too short'] });

    await expect(getMyProfile('token-123')).rejects.toThrow(
      'username must be lowercase, username too short',
    );
  });

  it('falls back to a generic message when the error body has no message', async () => {
    const { getMyProfile } = api;
    mockFetchOnce(500, {});

    await expect(getMyProfile('token-123')).rejects.toThrow('Request failed');
  });

  it('falls back to a generic message when the response body is not JSON', async () => {
    const { getMyProfile } = api;
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      },
    });

    await expect(getMyProfile('token-123')).rejects.toThrow('Request failed');
  });

  it('throws a clear error when EXPO_PUBLIC_API_BASE_URL is not set', async () => {
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    const { getMyProfile } = api;

    await expect(getMyProfile('token-123')).rejects.toThrow('Missing EXPO_PUBLIC_API_BASE_URL');
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
