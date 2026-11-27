import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';
import {
  clearBackgroundTypes,
  configureBackgroundTypes,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  subscribeToChanges,
} from '@kingstinct/react-native-healthkit';
import { importAppleHealth } from '../../lib/healthDataApi';
import { useAuth } from '../../auth/AuthProvider';
import { AppleHealthSync } from './AppleHealthSync';

jest.mock('../../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../../lib/healthDataApi', () => ({
  importAppleHealth: jest.fn(),
  disconnectAppleHealth: jest.fn(),
}));
jest.mock('../../lib/supabase', () => {
  const builder = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    for (const m of ['select', 'eq', 'gte', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = async () => ({
      data: {
        status: 'connected',
        devices: ['iPhone'],
        connected_at: '2026-11-20T10:00:00Z',
        last_synced_at: null,
        last_error: null,
      },
      error: null,
    });
    b.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
    return b;
  };
  return { supabase: { from: builder } };
});

function signedIn(as: string | null) {
  jest.mocked(useAuth).mockReturnValue({
    user: as ? { id: as } : null,
    session: as ? { access_token: 'token' } : null,
    status: as ? 'signedIn' : 'signedOut',
  } as never);
}

// Jest's AppState hands back nothing to remove; the app's does.
let appState: jest.SpyInstance;

beforeEach(() => {
  appState = jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((() => ({ remove: jest.fn() })) as never);
  jest.mocked(isHealthDataAvailable).mockReturnValue(true);
  jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(2);
  jest
    .mocked(importAppleHealth)
    .mockReset()
    .mockResolvedValue({ runId: 'r', upserted: 3, refused: [] });
  jest.mocked(subscribeToChanges).mockClear();
  jest.mocked(clearBackgroundTypes).mockClear();
  jest.mocked(configureBackgroundTypes).mockClear();
});

afterEach(() => appState.mockRestore());

afterAll(() => {
  jest.mocked(isHealthDataAvailable).mockReturnValue(false);
  jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(1);
});

describe('AppleHealthSync', () => {
  it('connected on this iPhone: syncs as the app opens and watches Apple Health for more', async () => {
    signedIn('me');
    render(<AppleHealthSync />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(importAppleHealth).toHaveBeenCalledTimes(1);
    expect(subscribeToChanges).toHaveBeenCalled();
    expect(appState).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('signing out stops HealthKit waking Progresso for them', async () => {
    signedIn('me');
    const view = render(<AppleHealthSync />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    signedIn(null);
    view.rerender(<AppleHealthSync />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(clearBackgroundTypes).toHaveBeenCalled();
  });
});
