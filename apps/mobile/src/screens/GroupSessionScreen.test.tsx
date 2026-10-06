import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { addGroupGuest, finishGroup, getGroup, inviteToGroup } from '../lib/api';
import { GroupSessionScreen } from './GroupSessionScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  addGroupGuest: jest.fn(),
  finishGroup: jest.fn(),
  getGroup: jest.fn(),
  inviteToGroup: jest.fn(),
  leaveGroup: jest.fn(),
}));

// The per-member editor is covered on its own; here it is a marker per workout.
jest.mock('../workouts/LiveWorkoutEditor', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    LiveWorkoutEditor: ({ workoutId, testID }: { workoutId: string; testID: string }) => (
      <Text testID={testID}>editor {workoutId}</Text>
    ),
  };
});

const mockUseAuth = useAuth as jest.Mock;
const mockGetGroup = getGroup as jest.Mock;
const mockInvite = inviteToGroup as jest.Mock;
const mockGuest = addGroupGuest as jest.Mock;
const mockFinish = finishGroup as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: jest.fn(), goBack: mockGoBack };

function group(overrides: Record<string, unknown> = {}) {
  return {
    id: 'g1',
    name: 'Thursday legs',
    status: 'live',
    hostId: 'me',
    startedAt: '2026-10-06T09:00:00.000Z',
    finishedAt: null,
    members: [
      {
        userId: 'me',
        displayName: 'Harbir',
        role: 'host',
        status: 'joined',
        isGuest: false,
        workoutId: 'w-me',
      },
      {
        userId: 'pat',
        displayName: 'Pat',
        role: 'member',
        status: 'joined',
        isGuest: true,
        workoutId: 'w-pat',
      },
      {
        userId: 'jo',
        displayName: 'Jo',
        role: 'member',
        status: 'invited',
        isGuest: false,
        workoutId: null,
      },
    ],
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <GroupSessionScreen navigation={navigation} route={{ params: { groupId: 'g1' } } as never} />,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'me' } });
  mockGetGroup.mockReset().mockResolvedValue(group());
  mockInvite.mockReset().mockResolvedValue({ userId: 'x', status: 'invited' });
  mockGuest.mockReset().mockResolvedValue({ userId: 'g' });
  mockFinish.mockReset().mockResolvedValue({ ok: true });
  mockGoBack.mockClear();
});

describe('GroupSessionScreen', () => {
  it('shows every joined member’s workout to edit, and the invited people as waiting', async () => {
    renderScreen();

    expect(await screen.findByTestId('group-workout-me')).toHaveTextContent('editor w-me');
    expect(screen.getByTestId('group-workout-pat')).toHaveTextContent('editor w-pat');
    expect(screen.getByTestId('group-session-invited')).toHaveTextContent(/Jo/);
  });

  it('adds a guest by name, with no account needed', async () => {
    renderScreen();

    fireEvent.changeText(await screen.findByTestId('group-guest-name'), 'Sam');
    fireEvent.press(screen.getByTestId('group-guest-submit'));

    await waitFor(() => expect(mockGuest).toHaveBeenCalledWith('token-1', 'g1', 'Sam'));
  });

  it('invites a friend or client by username', async () => {
    renderScreen();

    fireEvent.changeText(await screen.findByTestId('group-invite-username'), 'Friend_One');
    fireEvent.press(screen.getByTestId('group-invite-submit'));

    await waitFor(() => expect(mockInvite).toHaveBeenCalledWith('token-1', 'g1', 'friend_one'));
  });

  it('finishes the group for everyone, once the person confirms', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    renderScreen();

    fireEvent.press(await screen.findByTestId('group-finish'));
    const buttons = alert.mock.calls[0][2] ?? [];
    buttons.find((button) => button.text === 'Finish')?.onPress?.();

    await waitFor(() => expect(mockFinish).toHaveBeenCalledWith('token-1', 'g1'));
    alert.mockRestore();
  });
});
