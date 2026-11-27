import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import {
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
} from '@kingstinct/react-native-healthkit';
import { disconnectAppleHealth, importAppleHealth } from '../../lib/healthDataApi';
import { AppleHealthSyncCard, syncedAgo } from './AppleHealthSyncCard';
import { refreshAppleHealth, setAppleHealthAuth } from './appleHealthSyncStore';

jest.mock('../../lib/healthDataApi', () => ({
  importAppleHealth: jest.fn(),
  disconnectAppleHealth: jest.fn(),
}));

let mockConnection: Record<string, unknown> | null = null;
jest.mock('../../lib/supabase', () => {
  const builder = (table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    for (const m of ['select', 'eq', 'gte', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = async () => ({ data: mockConnection, error: null });
    b.then = (ok: (r: unknown) => unknown) =>
      Promise.resolve({
        data:
          table === 'health_daily_metrics'
            ? [
                {
                  metric: 'resting_hr_bpm',
                  day: new Date().toISOString().slice(0, 10),
                  value: '52',
                },
                { metric: 'sleep_asleep_s', day: '2026-11-20', value: '27000' },
              ]
            : [],
        error: null,
      }).then(ok);
    return b;
  };
  return { supabase: { from: (table: string) => builder(table) } };
});

const ACCENT = '#D99A50';

async function renderCard() {
  const onConnect = jest.fn();
  render(<AppleHealthSyncCard accent={ACCENT} onConnect={onConnect} />);
  await act(async () => {
    await refreshAppleHealth();
  });
  return onConnect;
}

beforeEach(() => {
  setAppleHealthAuth(null);
  setAppleHealthAuth({ userId: 'me', accessToken: 'token' });
  mockConnection = null;
  jest.mocked(isHealthDataAvailable).mockReturnValue(true);
  jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(2);
  jest
    .mocked(importAppleHealth)
    .mockReset()
    .mockResolvedValue({ runId: 'r', upserted: 30, refused: [] });
  jest
    .mocked(disconnectAppleHealth)
    .mockReset()
    .mockResolvedValue({ disconnected: true, deleted: 0 });
});

afterAll(() => {
  jest.mocked(isHealthDataAvailable).mockReturnValue(false);
  jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(1);
});

describe('Devices’ Apple Health card', () => {
  it('offers to connect when it never has been', async () => {
    const onConnect = await renderCard();
    expect(screen.getByTestId('status-notConnected')).toBeTruthy();
    fireEvent.press(screen.getByTestId('apple-health-sync-connect'));
    expect(onConnect).toHaveBeenCalled();
  });

  it('shows the connection, what’s behind it and what came in', async () => {
    mockConnection = {
      status: 'connected',
      devices: ['iPhone', 'Apple Watch'],
      connected_at: '2026-11-20T10:00:00Z',
      last_synced_at: new Date(Date.now() - 5 * 60_000).toISOString(),
      last_error: null,
    };
    await renderCard();
    expect(screen.getByTestId('status-connected')).toBeTruthy();
    expect(screen.getByTestId('apple-health-sync-synced')).toHaveTextContent('Synced 5 min ago');
    expect(screen.getByTestId('apple-health-sync-devices')).toHaveTextContent(
      'iPhone · Apple Watch',
    );
    expect(screen.getByTestId('apple-health-sync-value-resting_hr_bpm')).toHaveTextContent(
      /Resting Heart Rate52 bpmToday/,
    );
    expect(screen.getByTestId('apple-health-sync-value-sleep_asleep_s')).toHaveTextContent(
      /Time Asleep7h 30m/,
    );
  });

  it('asks this iPhone when the connection was made on another', async () => {
    mockConnection = {
      status: 'connected',
      devices: [],
      connected_at: '2026-11-20T10:00:00Z',
      last_synced_at: null,
      last_error: null,
    };
    jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(1);
    await renderCard();
    expect(screen.getByTestId('status-permission')).toBeTruthy();
    expect(screen.getByText(/Connected on another iPhone/)).toBeTruthy();
  });

  it('says what went wrong with the last sync', async () => {
    mockConnection = {
      status: 'error',
      devices: [],
      connected_at: '2026-11-20T10:00:00Z',
      last_synced_at: null,
      last_error: 'Could not save this sync',
    };
    await renderCard();
    expect(screen.getByTestId('status-issue')).toBeTruthy();
    expect(screen.getByTestId('apple-health-sync-error')).toHaveTextContent(
      'Could not save this sync',
    );
  });

  it('asks whether to keep the history when disconnecting', async () => {
    mockConnection = {
      status: 'connected',
      devices: [],
      connected_at: '2026-11-20T10:00:00Z',
      last_synced_at: null,
      last_error: null,
    };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderCard();
    fireEvent.press(screen.getByTestId('apple-health-sync-disconnect'));
    const buttons = alert.mock.calls[0]?.[2] ?? [];
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Keep History', 'Delete History']);
    await act(async () => {
      buttons.find((b) => b.text === 'Delete History')?.onPress?.();
    });
    expect(disconnectAppleHealth).toHaveBeenCalledWith('token', true);
    alert.mockRestore();
  });

  it('says it can’t here where Apple Health isn’t available', async () => {
    jest.mocked(isHealthDataAvailable).mockReturnValue(false);
    await renderCard();
    expect(screen.getByTestId('apple-health-sync-unavailable')).toBeTruthy();
  });
});

describe('syncedAgo', () => {
  const now = new Date('2026-11-27T15:00:00Z');
  it('reads as a person would say it', () => {
    expect(syncedAgo('2026-11-27T14:59:40Z', now)).toBe('just now');
    expect(syncedAgo('2026-11-27T14:20:00Z', now)).toBe('40 min ago');
    expect(syncedAgo('2026-11-27T10:00:00Z', now)).toBe('5 h ago');
  });
});
