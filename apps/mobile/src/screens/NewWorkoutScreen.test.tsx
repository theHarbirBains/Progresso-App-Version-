import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchExercises } from '../exercises/exerciseQueries';
import { addExerciseToWorkout, createWorkout } from '../workouts/workoutQueries';
import { NewWorkoutScreen } from './NewWorkoutScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../exercises/exerciseQueries', () => ({
  fetchExercises: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  createWorkout: jest.fn(),
  addExerciseToWorkout: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchExercises = fetchExercises as jest.Mock;
const mockCreateWorkout = createWorkout as jest.Mock;
const mockAddExerciseToWorkout = addExerciseToWorkout as jest.Mock;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, goBack: mockGoBack, replace: mockReplace };

const benchPress = {
  id: 'ex-bench',
  name: 'Barbell Bench Press',
  muscleGroup: 'chest',
  isActive: true,
  createdBy: null,
};
const squat = {
  id: 'ex-squat',
  name: 'Barbell Back Squat',
  muscleGroup: 'quadriceps',
  isActive: true,
  createdBy: null,
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockFetchExercises.mockReset().mockResolvedValue({ rows: [benchPress, squat], hasMore: false });
  mockCreateWorkout.mockReset();
  mockAddExerciseToWorkout.mockReset().mockResolvedValue('we-id');
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockReplace.mockClear();
});

// FlatList/VirtualizedList schedules a deferred internal setState (cell
// render bookkeeping) via a real setTimeout that can otherwise fire after a
// test ends. Calling this at the end of each test, while the component is
// still mounted, lets that pending timer settle inside act() before RNTL's
// automatic cleanup unmounts it (see ExerciseLibraryScreen.test.tsx for the
// original diagnosis of this pattern).
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}

describe('NewWorkoutScreen', () => {
  it('loads the exercise picker on mount', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('picker-exercise-ex-bench')).toHaveTextContent(
      /Barbell Bench Press/,
    );
    await settle();
  });

  it('adds an exercise to the selection when tapped, and does not duplicate it', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('picker-exercise-ex-bench');

    fireEvent.press(screen.getByTestId('picker-exercise-ex-bench'));
    fireEvent.press(screen.getByTestId('picker-exercise-ex-bench'));

    expect(screen.getByText('Exercises (1)')).toBeTruthy();
    await settle();
  });

  it('removes an exercise from the selection', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('picker-exercise-ex-bench');
    fireEvent.press(screen.getByTestId('picker-exercise-ex-bench'));
    await screen.findByTestId('remove-selected-ex-bench');

    fireEvent.press(screen.getByTestId('remove-selected-ex-bench'));

    expect(screen.queryByText('Exercises (1)')).toBeNull();
    await settle();
  });

  it('reorders selected exercises with move up/down', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('picker-exercise-ex-bench');
    fireEvent.press(screen.getByTestId('picker-exercise-ex-bench'));
    fireEvent.press(await screen.findByTestId('picker-exercise-ex-squat'));
    await screen.findByTestId('move-down-ex-bench');

    fireEvent.press(screen.getByTestId('move-down-ex-bench'));

    // Bench should now be second and squat first -- start the workout and
    // check the order exercises were added in reflects the swap.
    fireEvent.changeText(screen.getByTestId('new-workout-name'), 'Leg Day');
    mockCreateWorkout.mockResolvedValue({
      type: 'created',
      workout: {
        id: 'w1',
        name: 'Leg Day',
        performedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      },
    });
    await act(async () => {
      fireEvent.press(screen.getByTestId('start-workout'));
    });

    await waitFor(() => expect(mockAddExerciseToWorkout).toHaveBeenCalledTimes(2));
    expect(mockAddExerciseToWorkout).toHaveBeenNthCalledWith(1, 'w1', 'ex-squat', 1);
    expect(mockAddExerciseToWorkout).toHaveBeenNthCalledWith(2, 'w1', 'ex-bench', 2);
    await settle();
  });

  it('disables Start Workout until a name and at least one exercise are set', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('picker-exercise-ex-bench');

    expect(screen.getByTestId('start-workout').props.accessibilityState.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('new-workout-name'), 'Push Day');
    expect(screen.getByTestId('start-workout').props.accessibilityState.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('picker-exercise-ex-bench'));
    expect(screen.getByTestId('start-workout').props.accessibilityState.disabled).toBe(false);
    await settle();
  });

  it('creates the workout, adds exercises in order, and replaces to ActiveWorkout', async () => {
    mockCreateWorkout.mockResolvedValue({
      type: 'created',
      workout: {
        id: 'w1',
        name: 'Push Day',
        performedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      },
    });

    render(<NewWorkoutScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('picker-exercise-ex-bench');
    fireEvent.changeText(screen.getByTestId('new-workout-name'), 'Push Day');
    fireEvent.press(screen.getByTestId('picker-exercise-ex-bench'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('start-workout'));
    });

    expect(mockCreateWorkout).toHaveBeenCalledWith('user-1', 'Push Day');
    await waitFor(() => expect(mockAddExerciseToWorkout).toHaveBeenCalledWith('w1', 'ex-bench', 1));
    expect(mockReplace).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'w1' });
    await settle();
  });

  it('shows a resume option instead of a raw error on an active-workout conflict', async () => {
    mockCreateWorkout.mockResolvedValue({
      type: 'conflict',
      existingWorkout: {
        id: 'existing',
        name: 'Leg Day',
        performedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      },
    });

    render(<NewWorkoutScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('picker-exercise-ex-bench');
    fireEvent.changeText(screen.getByTestId('new-workout-name'), 'Push Day');
    fireEvent.press(screen.getByTestId('picker-exercise-ex-bench'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('start-workout'));
    });

    expect(await screen.findByTestId('resume-instead')).toBeTruthy();
    expect(screen.getByText(/Leg Day/)).toBeTruthy();
    expect(mockAddExerciseToWorkout).not.toHaveBeenCalled();
    expect(screen.queryByTestId('new-workout-error')).toBeNull();

    fireEvent.press(screen.getByTestId('resume-instead'));
    expect(mockReplace).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'existing' });
    await settle();
  });

  it('debounces the exercise search', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('picker-exercise-ex-bench');
    mockFetchExercises.mockClear();

    fireEvent.changeText(screen.getByTestId('new-workout-exercise-search'), 'bench');

    await waitFor(() =>
      expect(mockFetchExercises).toHaveBeenCalledWith(expect.objectContaining({ search: 'bench' })),
    );
    await settle();
  });

  it('goes back when Cancel is pressed', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('picker-exercise-ex-bench');

    fireEvent.press(screen.getByTestId('new-workout-back'));

    expect(mockGoBack).toHaveBeenCalled();
    await settle();
  });
});
