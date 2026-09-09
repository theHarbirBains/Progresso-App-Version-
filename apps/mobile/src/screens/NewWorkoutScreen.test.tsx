import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchExercises } from '../exercises/exerciseQueries';
import { getMyProfile } from '../lib/api';
import {
  addExerciseToWorkout,
  createSet,
  createWorkout,
  updateSet,
} from '../workouts/workoutQueries';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { NewWorkoutScreen } from './NewWorkoutScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../exercises/exerciseQueries', () => ({
  fetchExercises: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  createWorkout: jest.fn(),
  addExerciseToWorkout: jest.fn(),
  createSet: jest.fn(),
  updateSet: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplitDetail: jest.fn(),
  fetchLastWorkoutSplitDayId: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchExercises = fetchExercises as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockCreateWorkout = createWorkout as jest.Mock;
const mockAddExerciseToWorkout = addExerciseToWorkout as jest.Mock;
const mockCreateSet = createSet as jest.Mock;
const mockUpdateSet = updateSet as jest.Mock;
const mockFetchWorkoutSplitDetail = fetchWorkoutSplitDetail as jest.Mock;
const mockFetchLastWorkoutSplitDayId = fetchLastWorkoutSplitDayId as jest.Mock;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockReplace = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  replace: mockReplace,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

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

let setCounter = 0;

beforeEach(() => {
  setCounter = 0;
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockFetchExercises.mockReset().mockResolvedValue({ rows: [benchPress, squat], hasMore: false });
  mockGetMyProfile.mockReset().mockResolvedValue({
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    // Truthy by default so most tests exercise the normal planning flow --
    // the "no active split" blocking gate has its own dedicated tests below.
    activeWorkoutSplitId: 'split-1',
  });
  mockCreateWorkout.mockReset().mockResolvedValue({
    type: 'created',
    workout: { id: 'w1', name: 'Push Day', performedAt: '2026-01-01T00:00:00Z', completedAt: null },
  });
  mockAddExerciseToWorkout.mockReset().mockResolvedValue('we-id');
  mockCreateSet
    .mockReset()
    .mockImplementation(async (workoutExerciseId: string, setIndex: number) => {
      setCounter += 1;
      return {
        id: `set-${setCounter}`,
        setIndex,
        weightKg: null,
        reps: null,
        completedAt: null,
      };
    });
  mockUpdateSet.mockReset().mockResolvedValue({
    id: 'set-1',
    setIndex: 1,
    weightKg: 100,
    reps: 8,
    completedAt: '2026-01-01T00:00:00Z',
  });
  mockFetchWorkoutSplitDetail.mockReset();
  mockFetchLastWorkoutSplitDayId.mockReset().mockResolvedValue(null);
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  mockReplace.mockClear();
});

async function addExerciseViaPicker(testId: string) {
  fireEvent.press(await screen.findByTestId('new-workout-add-exercise'));
  fireEvent.press(await screen.findByTestId(testId));
}

describe('NewWorkoutScreen', () => {
  it('goes back when Back is pressed', () => {
    render(<NewWorkoutScreen navigation={navigation} route={route} />);

    fireEvent.press(screen.getByTestId('workout-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('adds an exercise via the exercise picker', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    fireEvent.changeText(await screen.findByTestId('new-workout-name'), 'Push Day');

    await addExerciseViaPicker('exercise-picker-item-ex-bench');

    expect(await screen.findByText('Barbell Bench Press')).toBeTruthy();
  });

  it('shows the muscle group from real exercise data, not hardcoded', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={route} />);

    await addExerciseViaPicker('exercise-picker-item-ex-squat');

    const card = await screen.findByTestId('exercise-card-ex-squat');
    expect(within(card).getByText('Quadriceps')).toBeTruthy();
  });

  it('a newly added exercise starts with exactly one set', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={route} />);

    await addExerciseViaPicker('exercise-picker-item-ex-bench');

    const card = await screen.findByTestId('exercise-card-ex-bench-set-ex-bench-0');
    expect(card).toBeTruthy();
    expect(screen.queryByTestId('exercise-card-ex-bench-set-ex-bench-1')).toBeNull();
  });

  it('Add Set adds exactly one more set', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    await addExerciseViaPicker('exercise-picker-item-ex-bench');
    await screen.findByTestId('exercise-card-ex-bench-set-ex-bench-0');

    fireEvent.press(screen.getByTestId('exercise-card-ex-bench-add-set'));

    expect(await screen.findByTestId('exercise-card-ex-bench-set-ex-bench-1')).toBeTruthy();
    expect(screen.queryByTestId('exercise-card-ex-bench-set-ex-bench-2')).toBeNull();
  });

  it('removes an exercise', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    await addExerciseViaPicker('exercise-picker-item-ex-bench');
    await screen.findByText('Barbell Bench Press');

    fireEvent.press(screen.getByTestId('exercise-card-ex-bench-remove'));

    expect(screen.queryByText('Barbell Bench Press')).toBeNull();
  });

  it('reorders exercises with the move controls', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    await addExerciseViaPicker('exercise-picker-item-ex-bench');
    await addExerciseViaPicker('exercise-picker-item-ex-squat');
    await screen.findByText('Barbell Back Squat');

    expect(screen.queryByTestId('exercise-card-ex-squat-move-up')).toBeTruthy();
    fireEvent.press(screen.getAllByTestId(/move-down/)[0]);

    // After moving Bench down, Squat should now render first.
    const names = screen.getAllByText(/Barbell/).map((n) => n.props.children);
    expect(names[0]).toContain('Barbell Back Squat');
  });

  it('disables Start Workout until a name and at least one exercise are present', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    fireEvent.changeText(await screen.findByTestId('new-workout-name'), '');

    fireEvent.press(screen.getByTestId('start-workout'));

    expect(mockCreateWorkout).not.toHaveBeenCalled();
  });

  it('starts the workout, creates the exercise and its one blank set, then navigates to ActiveWorkout', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    fireEvent.changeText(await screen.findByTestId('new-workout-name'), 'Push Day');
    await addExerciseViaPicker('exercise-picker-item-ex-bench');
    await screen.findByTestId('exercise-card-ex-bench-set-ex-bench-0');

    fireEvent.press(screen.getByTestId('start-workout'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'w1' }),
    );
    expect(mockCreateWorkout).toHaveBeenCalledWith('user-1', 'Push Day', undefined);
    expect(mockAddExerciseToWorkout).toHaveBeenCalledWith('w1', 'ex-bench', 1);
    expect(mockCreateSet).toHaveBeenCalledWith('we-id', 1);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('persists a set already filled in during planning as complete when starting', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    fireEvent.changeText(await screen.findByTestId('new-workout-name'), 'Push Day');
    await addExerciseViaPicker('exercise-picker-item-ex-bench');
    await screen.findByTestId('exercise-card-ex-bench-set-ex-bench-0');

    fireEvent.changeText(screen.getByTestId('exercise-card-ex-bench-set-ex-bench-0-weight'), '100');
    fireEvent.changeText(screen.getByTestId('exercise-card-ex-bench-set-ex-bench-0-reps'), '8');
    fireEvent.press(screen.getByTestId('start-workout'));

    await waitFor(() => expect(mockUpdateSet).toHaveBeenCalled());
    expect(mockUpdateSet).toHaveBeenCalledWith(
      'set-1',
      expect.objectContaining({ weightKg: 100, reps: 8, completedAt: expect.any(String) }),
    );
  });

  it('shows a resume option instead of creating a duplicate workout on conflict', async () => {
    mockCreateWorkout.mockResolvedValue({
      type: 'conflict',
      existingWorkout: {
        id: 'active-1',
        name: 'Leg Day',
        performedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      },
    });
    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    fireEvent.changeText(await screen.findByTestId('new-workout-name'), 'Push Day');
    await addExerciseViaPicker('exercise-picker-item-ex-bench');
    await screen.findByTestId('exercise-card-ex-bench-set-ex-bench-0');

    fireEvent.press(screen.getByTestId('start-workout'));

    fireEvent.press(await screen.findByTestId('resume-instead'));
    expect(mockReplace).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'active-1' });
    expect(mockAddExerciseToWorkout).not.toHaveBeenCalled();
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
      activeWorkoutSplitId: 'split-1',
    });

    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    await addExerciseViaPicker('exercise-picker-item-ex-bench');

    const badge = await screen.findByTestId('exercise-card-ex-bench-muscle-group');
    const text = badge.props.children;
    // Badge renders a single Text child whose style carries the accent color.
    const merged = Object.assign({}, ...[text.props.style].flat());
    expect(merged.color).toBe('#8B5CF6');
  });

  it('never renders RIR, RPE, estimated calories, or an exercise image', async () => {
    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    await addExerciseViaPicker('exercise-picker-item-ex-bench');
    await screen.findByText('Barbell Bench Press');

    expect(screen.queryByText(/RIR/i)).toBeNull();
    expect(screen.queryByText(/RPE/i)).toBeNull();
    expect(screen.queryByText(/calor/i)).toBeNull();
    expect(screen.queryByRole('image')).toBeNull();
  });
});

describe('NewWorkoutScreen without an active split', () => {
  it('blocks tracking and shows "Choose Your Workout Split" instead of the planning form', async () => {
    mockGetMyProfile.mockResolvedValue({
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

    render(<NewWorkoutScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('new-workout-no-split')).toBeTruthy();
    expect(screen.queryByTestId('new-workout-name')).toBeNull();
    expect(screen.queryByTestId('start-workout')).toBeNull();
  });

  it('navigates to ChooseWorkoutSplit when the button is pressed', async () => {
    mockGetMyProfile.mockResolvedValue({
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

    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    fireEvent.press(await screen.findByTestId('new-workout-choose-split'));

    expect(mockNavigate).toHaveBeenCalledWith('ChooseWorkoutSplit');
  });

  it('unblocks and shows the planning form once an active split exists (e.g. after returning from ChooseWorkoutSplit)', async () => {
    // A plain mutable flag (read fresh by every call) rather than
    // mockResolvedValueOnce: useProgressTheme's own independent getMyProfile
    // call and this screen's split check both read the same mock, in an
    // order this test shouldn't need to assume.
    let activeWorkoutSplitId: string | null = null;
    mockGetMyProfile.mockImplementation(async () => ({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'kg',
      workoutAccentColor: null,
      nutritionAccentColor: null,
      activeWorkoutSplitId,
    }));

    render(<NewWorkoutScreen navigation={navigation} route={route} />);
    await screen.findByTestId('new-workout-no-split');

    activeWorkoutSplitId = 'split-1';
    // Re-invoke only this render's own focus callback (the most recent
    // addListener registration), simulating returning to this screen.
    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    await focusCallback();

    expect(await screen.findByTestId('new-workout-name')).toBeTruthy();
    expect(screen.queryByTestId('new-workout-no-split')).toBeNull();
  });
});
