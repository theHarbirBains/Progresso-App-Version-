import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { finishGroup, getGroup } from '../lib/api';
import { nextWorkoutWidget, workoutActivity } from '../widgets/homeWidgets';
import { refreshNextWorkout } from '../widgets/nextWorkoutRefresh';
import { endWorkoutActivities } from '../widgets/workoutActivity';
import { GroupSessionScreen } from './GroupSessionScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  finishGroup: jest.fn(),
  getGroup: jest.fn(),
  leaveGroup: jest.fn(),
}));

jest.mock('../progress/useProgressTheme', () => ({
  useProgressTheme: () => ({
    theme: { accent: '#3DDC97', onAccent: '#000000' },
    weightUnit: 'kg',
    activeWorkoutSplitId: 'split-1',
  }),
}));

jest.mock('../widgets/nextWorkoutRefresh', () => ({ refreshNextWorkout: jest.fn() }));

// The group editor is covered on its own; here it is a marker listing the workouts it was given.
jest.mock('../workouts/GroupWorkoutEditor', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    GroupWorkoutEditor: ({
      members,
      testID,
    }: {
      members: { workoutId: string }[];
      testID: string;
    }) => <Text testID={testID}>editor {members.map((m) => m.workoutId).join(',')}</Text>,
  };
});

const mockUseAuth = useAuth as jest.Mock;
const mockGetGroup = getGroup as jest.Mock;
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
        workoutSplitDayId: null,
        workoutName: 'Thursday legs',
      },
      {
        userId: 'pat',
        displayName: 'Pat',
        role: 'member',
        status: 'joined',
        isGuest: true,
        workoutId: 'w-pat',
        workoutSplitDayId: 'day-1',
        workoutName: 'Push',
      },
      {
        userId: 'jo',
        displayName: 'Jo',
        role: 'member',
        status: 'invited',
        isGuest: false,
        workoutId: null,
        workoutSplitDayId: null,
        workoutName: null,
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

const mockStartActivity = workoutActivity.start as jest.Mock;

beforeEach(async () => {
  await endWorkoutActivities();
  mockStartActivity.mockClear();
  (nextWorkoutWidget.updateSnapshot as jest.Mock).mockClear();
  (refreshNextWorkout as jest.Mock).mockClear();
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'me' } });
  mockGetGroup.mockReset().mockResolvedValue(group());
  mockFinish.mockReset().mockResolvedValue({ ok: true });
  mockGoBack.mockClear();
});

describe('GroupSessionScreen', () => {
  it('gives the live workout every joined member’s workout, and shows the invited people as waiting', async () => {
    renderScreen();

    expect(await screen.findByTestId('group-workout')).toHaveTextContent(/w-me/);
    expect(screen.getByTestId('group-workout')).toHaveTextContent(/w-pat/);
    expect(screen.getByTestId('group-session-invited')).toHaveTextContent(/Jo/);
  });

  it('offers no way to add anyone once the group has started', async () => {
    renderScreen();

    await screen.findByTestId('group-workout');
    expect(screen.queryByTestId('group-invite-username')).toBeNull();
    expect(screen.queryByTestId('group-guest-name')).toBeNull();
    expect(screen.queryByTestId('group-open-add-clients')).toBeNull();
    expect(screen.queryByTestId('group-day-day-2')).toBeNull();
  });

  it('a finished group shows that it has finished, with no Finish button', async () => {
    mockGetGroup.mockResolvedValue(
      group({ status: 'finished', finishedAt: '2026-10-06T10:00:00.000Z' }),
    );
    renderScreen();

    expect(await screen.findByTestId('group-session-finished')).toBeTruthy();
    expect(screen.queryByTestId('group-finish')).toBeNull();
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

  it('puts the group on the Lock Screen and the Next Workout widget while you train in it', async () => {
    renderScreen();
    await screen.findByTestId('group-workout');

    expect(mockStartActivity).toHaveBeenCalledTimes(1);
    expect(mockStartActivity).toHaveBeenCalledWith(
      {
        title: 'Thursday legs',
        kind: 'Group workout',
        startedAt: Date.parse('2026-10-06T09:00:00.000Z'),
      },
      'progresso://groups/g1',
    );
    expect(nextWorkoutWidget.updateSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        eyebrow: 'Workout in Progress',
        title: 'Thursday legs',
        action: 'Resume',
        url: 'progresso://groups/g1',
      }),
    );
  });

  it('takes the card off the Lock Screen once the group is finished, and updates Next Workout', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    renderScreen();
    fireEvent.press(await screen.findByTestId('group-finish'));
    const card = mockStartActivity.mock.results[0].value;
    (workoutActivity.getInstances as jest.Mock).mockReturnValueOnce([card]);
    (alert.mock.calls[0][2] ?? []).find((button) => button.text === 'Finish')?.onPress?.();

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(card.end).toHaveBeenCalledWith('immediate');
    expect(refreshNextWorkout).toHaveBeenCalledWith('me', 'split-1');
    alert.mockRestore();
  });

  it('starts no card for a group that has already finished', async () => {
    mockGetGroup.mockResolvedValue(
      group({ status: 'finished', finishedAt: '2026-10-06T10:00:00.000Z' }),
    );
    renderScreen();

    await screen.findByTestId('group-session-finished');
    expect(mockStartActivity).not.toHaveBeenCalled();
  });
});
