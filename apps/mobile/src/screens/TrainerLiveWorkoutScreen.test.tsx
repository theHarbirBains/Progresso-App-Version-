import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { finishLiveWorkout, resolveClientExercise } from '../lib/api';
import { TrainerLiveWorkoutScreen } from './TrainerLiveWorkoutScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
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
