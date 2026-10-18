import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { listTrainerClients, startLiveWorkout } from '../lib/api';
import { forgetShown } from '../lib/lastShown';
import { fetchMyOpenLiveSessions } from '../trainer/clientQueries';
import { TrainerSessionsScreen } from './TrainerSessionsScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  listTrainerClients: jest.fn(),
  startLiveWorkout: jest.fn(),
}));

jest.mock('../trainer/clientQueries', () => ({
  fetchMyOpenLiveSessions: jest.fn(),
}));

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ theme: { accent: '#3DDC97', onAccent: '#000000' }, weightUnit: 'kg' }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockListTrainerClients = listTrainerClients as jest.Mock;
const mockStartLiveWorkout = startLiveWorkout as jest.Mock;
const mockFetchOpen = fetchMyOpenLiveSessions as jest.Mock;

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  // The page loads on focus -- which, as in the app, comes once as it opens.
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};

const sam = {
  clientId: 'client-1',
  status: 'active',
  source: 'managed',
  displayName: 'Sam',
  birthday: null,
  heightValue: 180,
  heightUnit: 'cm',
  weightValue: 80,
  weightUnit: 'kg',
};
const ana = { ...sam, clientId: 'client-2', displayName: 'Ana' };

const openForAna = {
  workoutId: 'live-1',
  clientId: 'client-2',
  clientName: 'Ana',
  startedAt: '2026-10-17T09:30:00.000Z',
};

function renderScreen() {
  return render(<TrainerSessionsScreen navigation={navigation} route={{} as never} />);
}

beforeEach(() => {
  forgetShown();
  mockUseAuth.mockReturnValue({
    session: { access_token: 'token-123' },
    user: { id: 'trainer-1' },
  });
  mockListTrainerClients.mockReset();
  mockStartLiveWorkout.mockReset();
  mockFetchOpen.mockReset();
  mockNavigate.mockClear();
});

describe('TrainerSessionsScreen', () => {
  it('lists the live sessions running now, and picks one back up', async () => {
    mockFetchOpen.mockResolvedValue([openForAna]);
    mockListTrainerClients.mockResolvedValue([sam, ana]);
    renderScreen();

    fireEvent.press(await screen.findByTestId('trainer-sessions-live-live-1'));
    expect(mockNavigate).toHaveBeenCalledWith('TrainerLiveWorkout', {
      workoutId: 'live-1',
      clientId: 'client-2',
      clientName: 'Ana',
      startedAt: '2026-10-17T09:30:00.000Z',
    });
  });

  it('shows no Live now widget when nothing is running', async () => {
    mockFetchOpen.mockResolvedValue([]);
    mockListTrainerClients.mockResolvedValue([sam]);
    renderScreen();

    await screen.findByTestId('trainer-sessions-clients');
    expect(screen.queryByTestId('trainer-sessions-live')).toBeNull();
  });

  it('lists active clients by name, and offers Resume for one with a session already running', async () => {
    mockFetchOpen.mockResolvedValue([openForAna]);
    mockListTrainerClients.mockResolvedValue([
      sam,
      ana,
      { ...sam, clientId: 'client-3', displayName: 'Lee', status: 'pending', source: 'linked' },
    ]);
    renderScreen();

    await screen.findByTestId('trainer-sessions-client-client-1');
    expect(screen.queryByTestId('trainer-sessions-client-client-3')).toBeNull();
    expect(screen.getByTestId('trainer-sessions-start-client-2')).toHaveTextContent(/Resume/);
    expect(screen.getByTestId('trainer-sessions-start-client-1')).toHaveTextContent(/Start/);
    // One live session at a time: Sam's Start waits for Ana's session to finish.
    expect(screen.getByTestId('trainer-sessions-start-client-1')).toBeDisabled();
    expect(screen.getByTestId('trainer-sessions-clients-note')).toHaveTextContent(
      /Finish Ana’s to start another/,
    );

    fireEvent.press(screen.getByTestId('trainer-sessions-start-client-2'));
    expect(mockNavigate).toHaveBeenCalledWith(
      'TrainerLiveWorkout',
      expect.objectContaining({ workoutId: 'live-1', clientId: 'client-2' }),
    );
  });

  it('asks before starting a live session, then opens it', async () => {
    mockFetchOpen.mockResolvedValue([]);
    mockListTrainerClients.mockResolvedValue([sam]);
    mockStartLiveWorkout.mockResolvedValue({ workoutId: 'new-live' });
    const alert = jest.spyOn(Alert, 'alert');
    renderScreen();

    fireEvent.press(await screen.findByTestId('trainer-sessions-start-client-1'));
    expect(mockStartLiveWorkout).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] ?? [];
    await act(async () => {
      buttons.find((button) => button.text === 'Start')?.onPress?.();
    });
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        'TrainerLiveWorkout',
        expect.objectContaining({ workoutId: 'new-live', clientId: 'client-1', clientName: 'Sam' }),
      ),
    );
    expect(mockStartLiveWorkout).toHaveBeenCalledWith('token-123', 'client-1', 'Live session');
    alert.mockRestore();
  });

  it('reopens showing what it showed last time, while it refreshes', async () => {
    mockFetchOpen.mockResolvedValue([openForAna]);
    mockListTrainerClients.mockResolvedValue([sam, ana]);
    const first = renderScreen();
    await screen.findByTestId('trainer-sessions-live-live-1');
    first.unmount();

    mockFetchOpen.mockReturnValue(new Promise(() => undefined));
    renderScreen();

    expect(screen.getByTestId('trainer-sessions-live-live-1')).toBeTruthy();
    expect(screen.queryByTestId('trainer-sessions-loading')).toBeNull();
  });

  it('logs a past workout for a client', async () => {
    mockFetchOpen.mockResolvedValue([]);
    mockListTrainerClients.mockResolvedValue([sam]);
    renderScreen();

    fireEvent.press(await screen.findByTestId('trainer-sessions-log-client-1'));
    expect(mockNavigate).toHaveBeenCalledWith('TrainerLogWorkout', {
      clientId: 'client-1',
      clientName: 'Sam',
    });
  });

  it('offers Add Client when there is no one to train yet', async () => {
    mockFetchOpen.mockResolvedValue([]);
    mockListTrainerClients.mockResolvedValue([]);
    renderScreen();

    fireEvent.press(await screen.findByTestId('trainer-sessions-add-client'));
    expect(mockNavigate).toHaveBeenCalledWith('TrainerClientForm');
  });

  it('shows an error with a retry when nothing can be loaded', async () => {
    mockFetchOpen.mockRejectedValueOnce(new Error('Network down'));
    mockListTrainerClients.mockResolvedValue([sam]);
    renderScreen();

    expect(await screen.findByTestId('trainer-sessions-error')).toHaveTextContent(/Network down/);

    mockFetchOpen.mockResolvedValue([]);
    fireEvent.press(screen.getByTestId('trainer-sessions-error-retry'));
    expect(await screen.findByTestId('trainer-sessions-client-client-1')).toBeTruthy();
  });
});
