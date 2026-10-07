import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getTrainerStatus, listTrainerClients } from '../lib/api';
import { TrainerClientsScreen } from './TrainerClientsScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ theme: { accent: '#3DDC97', onAccent: '#000000' }, weightUnit: 'kg' }),
}));

jest.mock('../lib/api', () => ({
  getTrainerStatus: jest.fn(),
  listTrainerClients: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetTrainerStatus = getTrainerStatus as jest.Mock;
const mockListTrainerClients = listTrainerClients as jest.Mock;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, goBack: mockGoBack };

const managed = {
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

function renderScreen() {
  return render(<TrainerClientsScreen navigation={navigation} route={{} as never} />);
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' } });
  mockGetTrainerStatus.mockReset();
  mockListTrainerClients.mockReset();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

describe('TrainerClientsScreen', () => {
  it("lists a trainer's clients with their status, and opens one", async () => {
    mockGetTrainerStatus.mockResolvedValue({ isTrainer: true });
    mockListTrainerClients.mockResolvedValue([
      managed,
      { ...managed, clientId: 'client-2', displayName: 'Ana', status: 'pending', source: 'linked' },
    ]);
    renderScreen();

    expect(await screen.findByTestId('trainer-client-client-1')).toHaveTextContent(
      /Managed account/,
    );
    expect(screen.getByTestId('trainer-client-client-2')).toHaveTextContent(
      /Waiting for them to accept/,
    );

    fireEvent.press(screen.getByTestId('trainer-client-client-1'));
    expect(mockNavigate).toHaveBeenCalledWith('TrainerClientDetail', {
      clientId: 'client-1',
      clientName: 'Sam',
    });
  });

  it('shows an invite that is still waiting as sent, with nothing to open yet', async () => {
    mockGetTrainerStatus.mockResolvedValue({ isTrainer: true });
    mockListTrainerClients.mockResolvedValue([
      {
        clientId: null,
        inviteId: 'invite-1',
        email: 'pat@example.com',
        status: 'invited',
        source: 'managed',
        displayName: 'Pat',
        birthday: null,
        heightValue: null,
        heightUnit: 'cm',
        weightValue: null,
        weightUnit: 'kg',
      },
    ]);
    renderScreen();

    const invite = await screen.findByTestId('trainer-invite-invite-1');
    expect(invite).toHaveTextContent(/Invite sent/);
    fireEvent.press(invite);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('explains that trainer mode needs a subscription, rather than showing an empty list', async () => {
    mockGetTrainerStatus.mockResolvedValue({ isTrainer: false });
    renderScreen();

    expect(await screen.findByTestId('trainer-clients-not-trainer')).toBeTruthy();
    expect(mockListTrainerClients).not.toHaveBeenCalled();
  });

  it('invites the trainer to add their first client when they have none', async () => {
    mockGetTrainerStatus.mockResolvedValue({ isTrainer: true });
    mockListTrainerClients.mockResolvedValue([]);
    renderScreen();

    fireEvent.press(await screen.findByTestId('trainer-clients-empty-add'));
    expect(mockNavigate).toHaveBeenCalledWith('TrainerClientForm');
  });

  it('shows the error and retries on request when loading fails', async () => {
    mockGetTrainerStatus.mockRejectedValueOnce(new Error('Network down'));
    mockGetTrainerStatus.mockResolvedValueOnce({ isTrainer: true });
    mockListTrainerClients.mockResolvedValue([managed]);
    renderScreen();

    expect(await screen.findByTestId('trainer-clients-error')).toHaveTextContent(/Network down/);
    fireEvent.press(screen.getByText('Retry'));
    await waitFor(() => expect(screen.getByTestId('trainer-client-client-1')).toBeTruthy());
  });
});

describe('TrainerClientsScreen grouping', () => {
  it('files each client under what needs doing for them', async () => {
    mockGetTrainerStatus.mockResolvedValue({ isTrainer: true });
    mockListTrainerClients.mockResolvedValue([
      { ...managed, clientId: 'client-2', displayName: 'Purnima', awaitingClaim: true },
      { ...managed, clientId: 'client-3', displayName: 'Ana', status: 'pending', source: 'linked' },
      { ...managed, clientId: null, inviteId: 'invite-1', displayName: 'Pat', status: 'invited' },
      managed,
    ]);
    renderScreen();

    expect(await screen.findByTestId('trainer-clients-tracked')).toHaveTextContent(/Purnima/);
    expect(screen.getByTestId('trainer-clients-pending')).toHaveTextContent(/Ana/);
    expect(screen.getByTestId('trainer-clients-invited')).toHaveTextContent(/Pat/);
    expect(screen.getByTestId('trainer-clients-active')).toHaveTextContent(/Sam/);
    expect(screen.getByTestId('trainer-clients-count-active')).toHaveTextContent(/1s*Active/);
    expect(screen.getByTestId('trainer-clients-count-waiting')).toHaveTextContent(/2s*Waiting/);
  });
});
