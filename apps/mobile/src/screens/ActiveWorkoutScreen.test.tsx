import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fetchExercises } from '../exercises/exerciseQueries';
import {
  addExerciseToWorkout,
  completeWorkout,
  createSet,
  fetchWorkoutDetail,
  removeExerciseFromWorkout,
  reorderExercises,
  updateSet,
} from '../workouts/workoutQueries';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../exercises/exerciseQueries', () => ({
  fetchExercises: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutDetail: jest.fn(),
  createSet: jest.fn(),
  updateSet: jest.fn(),
  addExerciseToWorkout: jest.fn(),
  removeExerciseFromWorkout: jest.fn(),
  reorderExercises: jest.fn(),
  completeWorkout: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchExercises = fetchExercises as jest.Mock;
const mockFetchWorkoutDetail = fetchWorkoutDetail as jest.Mock;
const mockCreateSet = createSet as jest.Mock;
const mockUpdateSet = updateSet as jest.Mock;
const mockAddExerciseToWorkout = addExerciseToWorkout as jest.Mock;
const mockRemoveExerciseFromWorkout = removeExerciseFromWorkout as jest.Mock;
const mockReorderExercises = reorderExercises as jest.Mock;
const mockCompleteWorkout = completeWorkout as jest.Mock;

const mockGoBack = jest.fn();
const mockReset = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, reset: mockReset };
const route = { params: { workoutId: 'w1' } } as never;

const baseWorkout = {
  id: 'w1',
  name: 'Push Day',
  performedAt: '2026-01-01T00:00:00Z',
  completedAt: null,
  exercises: [
    {
      id: 'we1',
      exerciseId: 'ex1',
      exerciseName: 'Barbell Bench Press',
      muscleGroup: 'chest' as const,
      orderIndex: 1,
      sets: [
        { id: 's1', setIndex: 1, weightKg: 100, reps: 10, completedAt: '2026-01-01T00:05:00Z' },
        { id: 's2', setIndex: 2, weightKg: null, reps: null, completedAt: null },
      ],
    },
  ],
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue({
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    activeWorkoutSplitId: null,
  });
  mockFetchExercises.mockReset().mockResolvedValue({ rows: [], hasMore: false });
  mockFetchWorkoutDetail.mockReset().mockResolvedValue(baseWorkout);
  mockCreateSet.mockReset().mockResolvedValue({
    id: 's3',
    setIndex: 3,
    weightKg: null,
    reps: null,
    completedAt: null,
  });
  mockUpdateSet.mockReset().mockImplementation(async (setId: string, updates: unknown) => ({
    id: setId,
    setIndex: 2,
    weightKg: null,
    reps: null,
    completedAt: null,
    ...(updates as object),
  }));
  mockAddExerciseToWorkout.mockReset().mockResolvedValue('we2');
  mockRemoveExerciseFromWorkout.mockReset().mockResolvedValue(undefined);
  mockReorderExercises.mockReset().mockResolvedValue(undefined);
  mockCompleteWorkout.mockReset().mockResolvedValue(undefined);
  mockGoBack.mockClear();
  mockReset.mockClear();
});

describe('ActiveWorkoutScreen', () => {
  it('loads the workout for the given workoutId (resuming the correct session)', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(mockFetchWorkoutDetail).toHaveBeenCalledWith('w1'));
    expect((await screen.findAllByText('Push Day')).length).toBeGreaterThan(0);
  });

  it('shows the muscle group from real exercise data, not hardcoded', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);

    const card = await screen.findByTestId('exercise-card-we1');
    expect(within(card).getByText('Chest')).toBeTruthy();
  });

  it('never renders RIR, RPE, estimated calories, or an exercise image', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    expect(screen.queryByText(/RIR/i)).toBeNull();
    expect(screen.queryByText(/RPE/i)).toBeNull();
    expect(screen.queryByText(/calor/i)).toBeNull();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('shows Total Sets reflecting every set that exists, including an incomplete one', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('workout-summary-total-sets')).toHaveTextContent('2');
  });

  it('shows Total Volume reflecting only logged (completed) sets', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);

    // Only s1 (100kg x 10) is completed; s2 is blank and contributes 0.
    expect(await screen.findByTestId('workout-summary-total-volume')).toHaveTextContent('1000 kg');
  });

  it('completing a set requires a valid weight and reps first', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    const completeButton = screen.getByTestId('exercise-card-we1-set-s2-complete');
    expect(completeButton.props.accessibilityState.disabled).toBe(true);
  });

  it('marks a set complete once weight and reps are entered, using the existing set-update path', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), '120');
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '6');
    fireEvent.press(screen.getByTestId('exercise-card-we1-set-s2-complete'));

    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's2',
        expect.objectContaining({ weightKg: 120, reps: 6, completedAt: expect.any(String) }),
      ),
    );
  });

  it('Total Sets increases by exactly one when Add Set is pressed', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');
    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('2');

    fireEvent.press(screen.getByTestId('exercise-card-we1-add-set'));

    await waitFor(() => expect(mockCreateSet).toHaveBeenCalledWith('we1', 3));
    expect(await screen.findByTestId('exercise-card-we1-set-s3')).toBeTruthy();
    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('3');
  });

  it('removes an exercise using the existing soft-delete function', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('exercise-card-we1-remove'));

    await waitFor(() => expect(mockRemoveExerciseFromWorkout).toHaveBeenCalledWith('we1'));
    expect(screen.queryByTestId('exercise-card-we1')).toBeNull();
  });

  it('adds an exercise mid-workout, which starts with exactly one blank set', async () => {
    mockFetchExercises.mockResolvedValue({
      rows: [
        {
          id: 'ex2',
          name: 'Barbell Back Squat',
          muscleGroup: 'quadriceps',
          isActive: true,
          createdBy: null,
        },
      ],
      hasMore: false,
    });

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-add-exercise'));
    fireEvent.press(await screen.findByTestId('exercise-picker-item-ex2'));

    await waitFor(() => expect(mockAddExerciseToWorkout).toHaveBeenCalledWith('w1', 'ex2', 2));
    expect(mockCreateSet).toHaveBeenCalledWith('we2', 1);
    const card = await screen.findByTestId('exercise-card-we2');
    expect(within(card).getByTestId('exercise-card-we2-set-s3')).toBeTruthy();
    expect(within(card).queryByTestId('exercise-card-we2-set-s3-2')).toBeNull();
  });

  it('opens the existing custom-exercise creation flow', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-create-custom'));

    expect(await screen.findByTestId('exercise-form-name')).toBeTruthy();
  });

  it('reorders exercises using the existing bulk reorder function', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      exercises: [
        ...baseWorkout.exercises,
        {
          id: 'we2',
          exerciseId: 'ex2',
          exerciseName: 'Barbell Back Squat',
          muscleGroup: 'quadriceps' as const,
          orderIndex: 2,
          sets: [],
        },
      ],
    });

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we2');

    fireEvent.press(screen.getByTestId('exercise-card-we2-move-up'));

    await waitFor(() =>
      expect(mockReorderExercises).toHaveBeenCalledWith([
        { id: 'we2', workoutId: 'w1', exerciseId: 'ex2', orderIndex: 1 },
        { id: 'we1', workoutId: 'w1', exerciseId: 'ex1', orderIndex: 2 },
      ]),
    );
  });

  it('uses the centralized Workout accent theme, not a hardcoded color', async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'kg',
      workoutAccentColor: '#8B5CF6',
      nutritionAccentColor: null,
      activeWorkoutSplitId: null,
    });

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);

    const badge = await screen.findByTestId('exercise-card-we1-muscle-group');
    const text = badge.props.children;
    const merged = Object.assign({}, ...[text.props.style].flat());
    expect(merged.color).toBe('#8B5CF6');
  });

  it('completes the workout via the header options menu using the existing completeWorkout function', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('workout-header-options'));
    fireEvent.press(screen.getByTestId('workout-action-complete'));

    await waitFor(() => expect(mockCompleteWorkout).toHaveBeenCalledWith('w1'));
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'WorkoutHistory' }] });
  });

  it('goes back when Back is pressed', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('workout-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows an error message when loading fails', async () => {
    mockFetchWorkoutDetail.mockRejectedValue(new Error('network error'));

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('active-workout-error')).toHaveTextContent('network error');
  });
});
