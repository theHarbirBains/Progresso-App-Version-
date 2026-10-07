import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import {
  addClientToGroup,
  addGroupGuest,
  createGroup,
  getTrainerStatus,
  inviteToGroup,
  listFollowing,
  listTrainerClients,
} from '../lib/api';
import { GroupStartScreen } from './GroupStartScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  addClientToGroup: jest.fn(),
  addGroupGuest: jest.fn(),
  createGroup: jest.fn(),
  getTrainerStatus: jest.fn(),
  inviteToGroup: jest.fn(),
  listFollowing: jest.fn(),
  listTrainerClients: jest.fn(),
}));

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({
    theme: { accent: '#3DDC97', onAccent: '#000000' },
    activeWorkoutSplitId: 'split-1',
    weightUnit: 'kg',
  }),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplitDetail: jest.fn(async () => ({
    id: 'split-1',
    name: 'Main',
    days: [
      { id: 'day-1', name: 'Push', orderIndex: 1, muscleGroups: ['chest'] },
      { id: 'day-2', name: 'Pull', orderIndex: 2, muscleGroups: ['back'] },
    ],
  })),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockCreate = createGroup as jest.Mock;
const mockInvite = inviteToGroup as jest.Mock;
const mockClient = addClientToGroup as jest.Mock;
const mockGuest = addGroupGuest as jest.Mock;
const mockFollowing = listFollowing as jest.Mock;
const mockTrainer = getTrainerStatus as jest.Mock;
const mockClients = listTrainerClients as jest.Mock;

const mockReplace = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { replace: mockReplace, goBack: jest.fn() };

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'me' } });
  mockCreate.mockReset().mockResolvedValue({ groupId: 'g9' });
  mockInvite.mockReset().mockResolvedValue({ userId: 'x', status: 'invited' });
  mockClient.mockReset().mockResolvedValue({ userId: 'c', status: 'joined' });
  mockGuest.mockReset().mockResolvedValue({ userId: 'g' });
  mockFollowing
    .mockReset()
    .mockResolvedValue([{ id: 'f1', username: 'sam_lifts', displayName: 'Sam', avatarUrl: null }]);
  mockTrainer.mockReset().mockResolvedValue({ isTrainer: true });
  mockClients.mockReset().mockResolvedValue([
    {
      clientId: 'c1',
      inviteId: null,
      email: null,
      status: 'active',
      awaitingClaim: false,
      source: 'managed',
      displayName: 'Pat',
      birthday: null,
      heightValue: null,
      heightUnit: 'cm',
      weightValue: null,
      weightUnit: 'kg',
    },
  ]);
  mockReplace.mockClear();
});

describe('GroupStartScreen', () => {
  it('keeps Start disabled until a workout is chosen', async () => {
    render(<GroupStartScreen navigation={navigation} route={{} as never} />);

    await screen.findByTestId('group-start-friend-f1');
    fireEvent.press(screen.getByTestId('group-start-submit'));
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('starts a group on a day of the split, with a friend and a client in it', async () => {
    render(<GroupStartScreen navigation={navigation} route={{} as never} />);

    fireEvent.press(await screen.findByTestId('group-start-friend-f1'));
    fireEvent.press(screen.getByTestId('group-start-client-c1'));
    fireEvent.press(screen.getByTestId('group-start-day-day-2'));
    fireEvent.press(screen.getByTestId('group-start-submit'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('GroupSession', { groupId: 'g9' }),
    );
    expect(mockCreate).toHaveBeenCalledWith('token-1', { name: 'Pull', splitDayId: 'day-2' });
    expect(mockInvite).toHaveBeenCalledWith('token-1', 'g9', 'sam_lifts');
    expect(mockClient).toHaveBeenCalledWith('token-1', 'g9', 'c1');
  });

  it('adds a guest by name, and starts a workout outside the split by its own name', async () => {
    render(<GroupStartScreen navigation={navigation} route={{} as never} />);

    fireEvent.changeText(await screen.findByTestId('group-start-guest-name'), 'Alex');
    fireEvent.press(screen.getByTestId('group-start-guest-add'));
    fireEvent.press(screen.getByTestId('group-start-outside'));
    fireEvent.changeText(screen.getByTestId('group-start-outside-name'), 'Arms and abs');
    fireEvent.press(screen.getByTestId('group-start-submit'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    expect(mockCreate).toHaveBeenCalledWith('token-1', {
      name: 'Arms and abs',
      workoutName: 'Arms and abs',
    });
    expect(mockGuest).toHaveBeenCalledWith('token-1', 'g9', 'Alex');
  });
});
