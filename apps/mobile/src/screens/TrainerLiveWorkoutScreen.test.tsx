import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { finishLiveWorkout, resolveClientExercise } from '../lib/api';
import { TrainerLiveWorkoutScreen } from './TrainerLiveWorkoutScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  cancelLiveWorkout: jest.fn(),
  finishLiveWorkout: jest.fn(),
  resolveClientExercise: jest.fn(),
}));

jest.mock('../workouts/LiveWorkoutEditor', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    LiveWorkoutEditor: jest.fn(({ workoutId, userId }: { workoutId: string; userId: string }) => (
      <Text testID="live-editor">{`${workoutId} by ${userId}`}</Text>
    )),
  };
});

const mockUseAuth = useAuth as jest.Mock;
const mockResolve = resolveClientExercise as jest.Mock;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: jest.fn(), navigate: jest.fn() };

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-1' }, user: { id: 'trainer-1' } });
  mockResolve.mockReset().mockResolvedValue({ exerciseId: 'client-copy-1' });
  (finishLiveWorkout as jest.Mock).mockReset().mockResolvedValue({ ok: true });
});

describe('TrainerLiveWorkoutScreen', () => {
  it('runs the session as the trainer, on the client’s workout', () => {
    render(
      <TrainerLiveWorkoutScreen
        navigation={navigation}
        route={{ params: { workoutId: 'w9', clientId: 'c1', clientName: 'Pat' } } as never}
      />,
    );

    expect(screen.getByTestId('live-editor')).toHaveTextContent('w9 by trainer-1');
    expect(screen.getByTestId('trainer-live-finish')).toBeTruthy();
  });

  it('discards the session only after the trainer confirms, and then goes back', async () => {
    const { Alert } = jest.requireActual('react-native');
    const { cancelLiveWorkout } = jest.requireMock('../lib/api') as {
      cancelLiveWorkout: jest.Mock;
    };
    cancelLiveWorkout.mockResolvedValue({ ok: true });
    const alert = jest.spyOn(Alert, 'alert');
    render(
      <TrainerLiveWorkoutScreen
        navigation={navigation}
        route={{ params: { workoutId: 'w9', clientId: 'c1', clientName: 'Pat' } } as never}
      />,
    );

    fireEvent.press(screen.getByTestId('trainer-live-cancel'));
    expect(cancelLiveWorkout).not.toHaveBeenCalled();
    const buttons = (alert.mock.calls[0][2] ?? []) as { text?: string; onPress?: () => void }[];
    buttons.find((button) => button.text === 'Discard session')?.onPress?.();

    await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
    expect(cancelLiveWorkout).toHaveBeenCalledWith('token-1', 'c1', 'w9');
    alert.mockRestore();
  });

  it('exposes the resolve step to the editor, so picked exercises become the client’s copies', async () => {
    const { LiveWorkoutEditor } = jest.requireMock('../workouts/LiveWorkoutEditor') as {
      LiveWorkoutEditor: jest.Mock;
    };
    render(
      <TrainerLiveWorkoutScreen
        navigation={navigation}
        route={{ params: { workoutId: 'w9', clientId: 'c1' } } as never}
      />,
    );
    const props = LiveWorkoutEditor.mock.calls.at(-1)?.[0] as {
      resolveExerciseId: (id: string) => Promise<string>;
    };
    await expect(props.resolveExerciseId('trainer-ex')).resolves.toBe('client-copy-1');
    expect(mockResolve).toHaveBeenCalledWith('token-1', 'c1', 'trainer-ex');
    fireEvent.press(screen.getByTestId('trainer-live-finish'));
  });
});
