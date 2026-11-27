import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import {
  getRequestStatusForAuthorization,
  isHealthDataAvailable,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';
import { importAppleHealth } from '../lib/healthDataApi';
import { setAppleHealthAuth } from '../health/sync/appleHealthSyncStore';
import { AppleHealthConnectScreen } from './AppleHealthConnectScreen';
import { expectNoBareText } from '../testUtils/expectNoBareText';

jest.mock('../lib/healthDataApi', () => ({
  importAppleHealth: jest.fn(),
  disconnectAppleHealth: jest.fn(),
}));

jest.mock('../lib/supabase', () => {
  const builder = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    for (const m of ['select', 'eq', 'gte', 'order', 'limit']) b[m] = () => b;
    b.maybeSingle = async () => ({ data: null, error: null });
    b.then = (ok: (r: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(ok);
    return b;
  };
  return { supabase: { from: builder } };
});

const navigation = { goBack: jest.fn() };

function renderScreen() {
  render(
    <AppleHealthConnectScreen
      navigation={navigation as never}
      route={{ key: 'k', name: 'AppleHealthConnect' } as never}
    />,
  );
}

beforeEach(() => {
  setAppleHealthAuth(null);
  setAppleHealthAuth({ userId: 'me', accessToken: 'token' });
  jest
    .mocked(importAppleHealth)
    .mockReset()
    .mockResolvedValue({ runId: 'r', upserted: 1080, refused: [] });
  navigation.goBack.mockClear();
});

afterEach(() => {
  jest.mocked(isHealthDataAvailable).mockReturnValue(false);
  jest.mocked(getRequestStatusForAuthorization).mockResolvedValue(1);
});

describe('Connect Apple Health', () => {
  it('says what it reads and how it’s kept before asking', async () => {
    jest.mocked(isHealthDataAvailable).mockReturnValue(true);
    renderScreen();
    expect(screen.getByTestId('apple-health-connect-reads')).toHaveTextContent(/Sleep/);
    expect(screen.getByTestId('apple-health-connect-reads')).toHaveTextContent(
      /Resting heart rate/i,
    );
    expect(screen.getByTestId('apple-health-connect-kept')).toHaveTextContent(
      /never your trainer, the people who follow you, or a group workout/,
    );
    expect(screen.getByTestId('apple-health-connect-kept')).toHaveTextContent(
      /never writes to Apple Health/,
    );
    expect(requestAuthorization).not.toHaveBeenCalled();
    await act(async () => {});
    expectNoBareText();
  });

  it('asks iPhone, brings in 90 days, then is done', async () => {
    jest.mocked(isHealthDataAvailable).mockReturnValue(true);
    renderScreen();
    await act(async () => {});
    fireEvent.press(screen.getByTestId('apple-health-connect-button'));
    await waitFor(() =>
      expect(screen.getByTestId('apple-health-connect-done')).toHaveTextContent(
        /1,080 figures brought in/,
      ),
    );
    expect(requestAuthorization).toHaveBeenCalled();
    expect(importAppleHealth).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({ trigger: 'connect' }),
    );
    fireEvent.press(screen.getByTestId('apple-health-connect-button'));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('says why it couldn’t, and offers to try again', async () => {
    jest.mocked(isHealthDataAvailable).mockReturnValue(true);
    jest
      .mocked(importAppleHealth)
      .mockRejectedValue(new Error('Health data isn’t being collected yet'));
    renderScreen();
    await act(async () => {});
    fireEvent.press(screen.getByTestId('apple-health-connect-button'));
    await waitFor(() =>
      expect(screen.getByTestId('apple-health-connect-error')).toHaveTextContent(
        'Health data isn’t being collected yet',
      ),
    );
    expect(screen.getByTestId('apple-health-connect-button')).toHaveTextContent(/Try Again/);
  });

  it('asks nothing where Apple Health isn’t available', async () => {
    renderScreen();
    expect(await screen.findByTestId('apple-health-connect-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('apple-health-connect-button')).toBeNull();
  });
});
