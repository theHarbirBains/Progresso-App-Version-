import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  endTrainerLink,
  getTrainerStatus,
  listMyTrainers,
  listTrainerClients,
  listTrainerRequests,
  respondToTrainerRequest,
} from '../lib/api';
import { TrainerAccessScreen } from './TrainerAccessScreen';
import { AppMenuContext } from '../navigation/AppMenuContext';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ theme: { accent: '#3DDC97', onAccent: '#000000' }, weightUnit: 'kg' }),
}));

jest.mock('../lib/api', () => ({
  endTrainerLink: jest.fn(),
  getTrainerStatus: jest.fn(),
  listMyTrainers: jest.fn(),
  listTrainerClients: jest.fn(),
  listTrainerRequests: jest.fn(),
  respondToTrainerRequest: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetTrainerStatus = getTrainerStatus as jest.Mock;
const mockListTrainerRequests = listTrainerRequests as jest.Mock;
const mockListMyTrainers = listMyTrainers as jest.Mock;
const mockListTrainerClients = listTrainerClients as jest.Mock;
const mockRespond = respondToTrainerRequest as jest.Mock;
const mockEndTrainerLink = endTrainerLink as jest.Mock;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  addListener: jest.fn(() => () => undefined),
};

const TRAINER_ID = 'trainer-1';
const request = {
  trainerId: TRAINER_ID,
  trainerDisplayName: 'Coach Jo',
  requestedAt: '2026-10-01T00:00:00.000Z',
};

const sam = {
  clientId: 'client-sam',
  inviteId: null,
  email: null,
  status: 'active',
  awaitingClaim: false,
  source: 'managed',
  displayName: 'Sam',
  birthday: null,
  heightValue: null,
  heightUnit: 'cm',
  weightValue: null,
  weightUnit: 'kg',
};

function renderScreen() {
  return render(<TrainerAccessScreen navigation={navigation} route={{} as never} />);
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    session: { access_token: 'token-123' },
    user: { id: 'client-1' },
  });
  mockGetTrainerStatus.mockReset().mockResolvedValue({ isTrainer: false });
  mockListTrainerRequests.mockReset().mockResolvedValue([]);
  mockListMyTrainers.mockReset().mockResolvedValue([]);
  mockListTrainerClients.mockReset().mockResolvedValue([]);
  mockRespond.mockReset().mockResolvedValue({ ok: true });
  mockEndTrainerLink.mockReset().mockResolvedValue({ ok: true });
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

describe('TrainerAccessScreen', () => {
  it('shows a pending trainer request, and accepting it sends the decision and reloads', async () => {
    mockListTrainerRequests.mockResolvedValueOnce([request]).mockResolvedValueOnce([]);
    renderScreen();

    expect(await screen.findByTestId(`trainer-request-${TRAINER_ID}`)).toHaveTextContent(
      /Coach Jo/,
    );
    fireEvent.press(screen.getByTestId(`trainer-request-accept-${TRAINER_ID}`));

    await waitFor(() =>
      expect(mockRespond).toHaveBeenCalledWith('token-123', TRAINER_ID, 'accept'),
    );
    await waitFor(() => expect(screen.queryByTestId(`trainer-request-${TRAINER_ID}`)).toBeNull());
  });

  it('declines a request with the decline action', async () => {
    mockListTrainerRequests.mockResolvedValue([request]);
    renderScreen();

    fireEvent.press(await screen.findByTestId(`trainer-request-decline-${TRAINER_ID}`));
    await waitFor(() =>
      expect(mockRespond).toHaveBeenCalledWith('token-123', TRAINER_ID, 'decline'),
    );
  });

  it('lets a trainer see their clients in the Clients widget, and open one', async () => {
    mockGetTrainerStatus.mockResolvedValue({ isTrainer: true });
    mockListTrainerClients.mockResolvedValue([sam]);
    renderScreen();

    expect(await screen.findByTestId('trainer-access-clients')).toHaveTextContent(/Sam/);
    expect(screen.getByTestId('trainer-access-add-client')).toBeTruthy();
    fireEvent.press(screen.getByTestId('trainer-access-client-client-sam'));
    expect(mockNavigate).toHaveBeenCalledWith('TrainerClientDetail', {
      clientId: 'client-sam',
      clientName: 'Sam',
    });
  });

  it('says clients need a Trainer subscription for everyone else, and still offers tracked history', async () => {
    renderScreen();

    const widget = await screen.findByTestId('trainer-access-clients');
    expect(widget).toHaveTextContent(/Clients need a Trainer subscription/);
    fireEvent.press(screen.getByTestId('trainer-access-open-claim'));
    expect(mockNavigate).toHaveBeenCalledWith('TrainerClaim');
  });

  it('has no activity widget', async () => {
    mockGetTrainerStatus.mockResolvedValue({ isTrainer: true });
    mockListTrainerClients.mockResolvedValue([sam]);
    renderScreen();

    await screen.findByTestId('trainer-access-clients');
    expect(screen.queryByText('Activity')).toBeNull();
  });

  it('explains the empty state when there is nothing to show', async () => {
    renderScreen();
    expect(await screen.findByTestId('trainer-access-empty')).toBeTruthy();
  });

  it('ends a trainer link only after the client confirms', async () => {
    mockListMyTrainers.mockResolvedValue([
      {
        trainerId: TRAINER_ID,
        trainerDisplayName: 'Coach Jo',
        requestedAt: '2026-10-01T00:00:00.000Z',
      },
    ]);
    const alert = jest.spyOn(Alert, 'alert');
    renderScreen();

    fireEvent.press(await screen.findByTestId(`trainer-end-${TRAINER_ID}`));
    expect(mockEndTrainerLink).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] ?? [];
    const confirm = buttons.find((button) => button.text === 'End link');
    confirm?.onPress?.();
    await waitFor(() => expect(mockEndTrainerLink).toHaveBeenCalledWith('token-123', TRAINER_ID));
    alert.mockRestore();
  });

  it('has no back arrow, and lists every client a trainer has', async () => {
    mockGetTrainerStatus.mockResolvedValue({ isTrainer: true });
    mockListTrainerClients.mockResolvedValue([
      sam,
      { ...sam, clientId: 'client-ana', displayName: 'Ana' },
    ]);
    renderScreen();

    expect(await screen.findByTestId('trainer-access-client-client-sam')).toBeTruthy();
    expect(screen.getByTestId('trainer-access-client-client-ana')).toBeTruthy();
    expect(screen.queryByLabelText('Back')).toBeNull();
  });

  it('opens the side menu from the top left -- it is a menu page', async () => {
    const openMenu = jest.fn();
    render(
      <AppMenuContext.Provider value={{ openMenu, currentMode: 'workout' }}>
        <TrainerAccessScreen navigation={navigation} route={{} as never} />
      </AppMenuContext.Provider>,
    );

    fireEvent.press(await screen.findByTestId('trainer-access-open-menu'));
    expect(openMenu).toHaveBeenCalled();
  });

  it("opens with an overview: who can log for you, requests, and a trainer's clients", async () => {
    mockGetTrainerStatus.mockResolvedValue({ isTrainer: true });
    mockListTrainerClients.mockResolvedValue([sam]);
    mockListMyTrainers.mockResolvedValue([
      {
        trainerId: TRAINER_ID,
        trainerDisplayName: 'Coach Jo',
        requestedAt: '2026-10-01T00:00:00.000Z',
      },
    ]);
    renderScreen();

    expect(await screen.findByTestId('trainer-access-status')).toHaveTextContent(
      'One trainer can log workouts for you.',
    );
    expect(screen.getByTestId('trainer-access-stat-trainers')).toHaveTextContent(/1/);
    expect(screen.getByTestId('trainer-access-stat-requests')).toHaveTextContent(/0/);
    expect(screen.getByTestId('trainer-access-stat-clients')).toHaveTextContent(/1/);
  });

  it('shows no clients count to someone who is not a trainer', async () => {
    renderScreen();

    expect(await screen.findByTestId('trainer-access-status')).toHaveTextContent(
      'No trainer can log workouts for you right now.',
    );
    expect(screen.queryByTestId('trainer-access-stat-clients')).toBeNull();
  });

  it('explains how trainer access works, and offers linking tracked history as its own widget', async () => {
    renderScreen();

    const how = await screen.findByTestId('trainer-access-how');
    expect(how).toHaveTextContent(/A trainer asks/);
    expect(how).toHaveTextContent(/You decide/);
    expect(how).toHaveTextContent(/End it any time/);
    expect(screen.getByTestId('trainer-access-claim')).toHaveTextContent(/Link tracked history/);
  });
});
