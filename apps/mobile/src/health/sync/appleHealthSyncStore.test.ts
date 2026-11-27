import {
  clearBackgroundTypes,
  configureBackgroundTypes,
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  isProtectedDataAvailable,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { disconnectAppleHealth, importAppleHealth } from '../../lib/healthDataApi';
import { APPLE_HEALTH_READ_TYPES } from './appleHealthMetrics';
import {
  appleHealthSyncState,
  connectAppleHealth,
  connectedHere,
  disconnectAppleHealthSync,
  refreshAppleHealth,
  setAppleHealthAuth,
  syncAppleHealthIfDue,
  syncFrom,
  toImport,
} from './appleHealthSyncStore';

jest.mock('../../lib/healthDataApi', () => ({
  importAppleHealth: jest.fn(),
  disconnectAppleHealth: jest.fn(),
}));

// Their own connection and latest values, as RLS would hand them back.
let mockConnectionRow: Record<string, unknown> | null = null;
jest.mock('../../lib/supabase', () => {
  const builder = (table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    for (const m of ['select', 'eq', 'gte', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = async () => ({ data: mockConnectionRow, error: null });
    b.then = (ok: (r: unknown) => unknown) =>
      Promise.resolve({
        data:
          table === 'health_daily_metrics'
            ? [{ metric: 'steps', day: '2026-11-27', value: '4210' }]
            : [],
        error: null,
      }).then(ok);
    return b;
  };
  return { supabase: { from: (table: string) => builder(table) } };
});

const ME = { userId: 'me', accessToken: 'token' };
const connected = {
  status: 'connected',
  devices: ['iPhone', 'Apple Watch'],
  connected_at: '2026-11-20T10:00:00Z',
  last_synced_at: '2026-11-26T10:00:00Z',
  last_error: null,
};

beforeEach(() => {
  setAppleHealthAuth(null);
  setAppleHealthAuth(ME);
  mockConnectionRow = null;
  jest.mocked(isHealthDataAvailable).mockReturnValue(true);
  jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(2);
  jest.mocked(isProtectedDataAvailable).mockReturnValue(true);
  jest
    .mocked(importAppleHealth)
    .mockReset()
    .mockResolvedValue({ runId: 'r', upserted: 12, refused: [] });
  jest
    .mocked(disconnectAppleHealth)
    .mockReset()
    .mockResolvedValue({ disconnected: true, deleted: 0 });
  jest.mocked(configureBackgroundTypes).mockClear();
  jest.mocked(clearBackgroundTypes).mockClear();
  jest.mocked(requestAuthorization).mockClear();
});

afterAll(() => {
  jest.mocked(isHealthDataAvailable).mockReturnValue(false);
  jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(1);
});

describe('syncFrom', () => {
  const now = new Date(2026, 10, 27, 15);
  it('brings in 90 days on connecting, or with no sync before', () => {
    expect(syncFrom('connect', '2026-11-26T10:00:00Z', now)).toEqual(new Date(2026, 7, 30));
    expect(syncFrom('app_open', null, now)).toEqual(new Date(2026, 7, 30));
  });

  it('looks again from two days before the last sync, at least two days back', () => {
    expect(syncFrom('app_open', new Date(2026, 10, 20, 9).toISOString(), now)).toEqual(
      new Date(2026, 10, 18),
    );
    expect(syncFrom('background', now.toISOString(), now)).toEqual(new Date(2026, 10, 25));
  });

  it('never more than 90 days back', () => {
    expect(syncFrom('app_open', '2026-01-01T00:00:00Z', now)).toEqual(new Date(2026, 7, 30));
  });
});

describe('toImport', () => {
  it('leaves out what a night doesn’t have -- never a null or a made-up 0', () => {
    const sync = toImport('manual', {
      values: [],
      cleared: [],
      sleep: [
        {
          sourceRef: 'night:2026-11-26',
          day: '2026-11-26',
          startedAt: 'a',
          endedAt: 'b',
          inBedS: 28800,
          asleepS: null,
          awakeS: null,
          remS: null,
          lightS: null,
          deepS: null,
          device: null,
        },
      ],
      clearedSleep: [],
      devices: ['iPhone'],
      failed: [],
    });
    expect(sync.sleep).toEqual([
      { sourceRef: 'night:2026-11-26', startedAt: 'a', endedAt: 'b', inBedS: 28800 },
    ]);
  });
});

describe('connecting', () => {
  it('asks to read Health’s types, sets up background delivery, and brings in 90 days', async () => {
    jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(1);
    await expect(connectAppleHealth()).resolves.toBe(true);
    expect(requestAuthorization).toHaveBeenCalledWith({ toRead: APPLE_HEALTH_READ_TYPES });
    expect(configureBackgroundTypes).toHaveBeenCalledWith(expect.any(Array), 2);
    expect(importAppleHealth).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ trigger: 'connect' }),
    );
    expect(appleHealthSyncState().lastSync).toEqual(
      expect.objectContaining({ upserted: 12, refused: 0, trigger: 'connect' }),
    );
  });

  it('says why when the server won’t take it', async () => {
    jest
      .mocked(importAppleHealth)
      .mockRejectedValue(new Error('Health data isn’t being collected yet'));
    await expect(connectAppleHealth()).resolves.toBe(false);
    expect(appleHealthSyncState().error).toBe('Health data isn’t being collected yet');
  });
});

describe('syncing by itself', () => {
  it('only where it’s connected on this iPhone -- a new phone without permission would clear what’s kept', async () => {
    mockConnectionRow = connected;
    jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(1);
    await refreshAppleHealth();
    expect(connectedHere()).toBe(false);
    await syncAppleHealthIfDue('app_open');
    expect(importAppleHealth).not.toHaveBeenCalled();
  });

  it('syncs where it is, then not again so soon', async () => {
    mockConnectionRow = connected;
    await refreshAppleHealth();
    expect(connectedHere()).toBe(true);
    await syncAppleHealthIfDue('background');
    await syncAppleHealthIfDue('background');
    expect(importAppleHealth).toHaveBeenCalledTimes(1);
    expect(importAppleHealth).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ trigger: 'background' }),
    );
    expect(appleHealthSyncState().latest).toEqual([
      { metric: 'steps', day: '2026-11-27', value: 4210 },
    ]);
  });

  it('waits while the phone is locked -- Apple Health can’t be read then', async () => {
    mockConnectionRow = connected;
    await refreshAppleHealth();
    jest.mocked(isProtectedDataAvailable).mockReturnValue(false);
    await syncAppleHealthIfDue('background');
    expect(importAppleHealth).not.toHaveBeenCalled();
  });
});

describe('disconnecting', () => {
  it('stops HealthKit waking Progresso, keeping or deleting the history', async () => {
    await disconnectAppleHealthSync(true);
    expect(disconnectAppleHealth).toHaveBeenCalledWith('token', true);
    expect(clearBackgroundTypes).toHaveBeenCalled();
  });
});
