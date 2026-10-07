import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { addClientToGroup, getGroup, getTrainerStatus, listTrainerClients } from '../lib/api';
import { GroupAddClientsScreen } from './GroupAddClientsScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  addClientToGroup: jest.fn(),
  getGroup: jest.fn(),
  getTrainerStatus: jest.fn(),
  listTrainerClients: jest.fn(),
}));

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({ theme: { accent: '#3DDC97', onAccent: '#000000' }, weightUnit: 'kg' }),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockTrainer = getTrainerStatus as jest.Mock;
const mockGroup = getGroup as jest.Mock;
const mockClients = listTrainerClients as jest.Mock;
const mockAdd = addClientToGroup as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: jest.fn() };

function client(id: string, displayName: string) {
  return {
    clientId: id,
    inviteId: null,
    email: null,
    status: 'active',
    awaitingClaim: false,
    source: 'managed',
    displayName,
    birthday: null,
    heightValue: null,
    heightUnit: 'cm',
    weightValue: null,
    weightUnit: 'kg',
  };
}

const CLIENTS = [
  client('c-zoe', 'Zoe'),
  client('c-ana', 'Ana'),
  client('c-mia', 'Mia'),
  client('c-ben', 'Ben'),
];

function renderScreen() {
  return render(
    <GroupAddClientsScreen
      navigation={navigation}
      route={{ params: { groupId: 'g1' } } as never}
    />,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' } });
  mockTrainer.mockReset().mockResolvedValue({ isTrainer: true });
  // Mia is already in the group, so she is not offered.
  mockGroup.mockReset().mockResolvedValue({
    id: 'g1',
    members: [{ userId: 'c-mia' }],
  });
  mockClients.mockReset().mockResolvedValue(CLIENTS);
  mockAdd.mockReset().mockResolvedValue({ userId: 'x', status: 'joined' });
  mockGoBack.mockClear();
});

describe('GroupAddClientsScreen', () => {
  it('offers the clients not yet in the group, sorted by name', async () => {
    renderScreen();

    expect(await screen.findByTestId('group-add-client-row-c-ana')).toBeTruthy();
    expect(screen.queryByTestId('group-add-client-row-c-mia')).toBeNull();
    expect(screen.getByText('3 clients')).toBeTruthy();
  });

  it('narrows the list as someone types a name', async () => {
    renderScreen();

    fireEvent.changeText(await screen.findByTestId('group-add-clients-search-input'), 'be');

    expect(await screen.findByTestId('group-add-client-row-c-ben')).toBeTruthy();
    expect(screen.queryByTestId('group-add-client-row-c-ana')).toBeNull();
    expect(screen.getByText('1 of 3 match')).toBeTruthy();
  });

  it('adds every selected client, then goes back', async () => {
    renderScreen();

    fireEvent.press(await screen.findByTestId('group-add-client-row-c-ana'));
    fireEvent.press(screen.getByTestId('group-add-client-row-c-zoe'));
    fireEvent.press(screen.getByTestId('group-add-clients-submit'));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(mockAdd).toHaveBeenCalledWith('token-1', 'g1', 'c-ana');
    expect(mockAdd).toHaveBeenCalledWith('token-1', 'g1', 'c-zoe');
    expect(mockAdd).toHaveBeenCalledTimes(2);
  });

  it('copes with a long list of clients, and says how many there are', async () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      client(`c-${i}`, `Client ${String(i).padStart(3, '0')}`),
    );
    mockClients.mockResolvedValue(many);
    renderScreen();

    expect(await screen.findByText('120 clients')).toBeTruthy();
    expect(screen.queryByTestId('group-add-clients-index')).toBeNull();
  });
});
