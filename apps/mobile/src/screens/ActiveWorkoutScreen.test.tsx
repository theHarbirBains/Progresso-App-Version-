import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { BackgroundThemeProvider } from '../design/BackgroundThemeContext';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { colors, fonts } from '../design/theme';
import { DEFAULT_WORKOUT_COLOR } from '../theme/accentColor';
import { createExercise, getMyProfile } from '../lib/api';
import { fetchExercises } from '../exercises/exerciseQueries';
import {
  addExerciseToWorkout,
  cancelWorkout,
  completeWorkout,
  createSet,
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  removeExerciseFromWorkout,
  reorderExercises,
  updateSet,
} from '../workouts/workoutQueries';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
  createExercise: jest.fn(),
  updateExercise: jest.fn(),
  createEquipmentProfile: jest.fn(),
}));

jest.mock('../lib/equipmentPhotoUpload', () => ({
  uploadEquipmentPhoto: jest.fn(),
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
  cancelWorkout: jest.fn(),
  fetchPreviousPerformance: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockCreateExercise = createExercise as jest.Mock;
const mockFetchExercises = fetchExercises as jest.Mock;
const mockFetchWorkoutDetail = fetchWorkoutDetail as jest.Mock;
const mockCreateSet = createSet as jest.Mock;
const mockUpdateSet = updateSet as jest.Mock;
const mockAddExerciseToWorkout = addExerciseToWorkout as jest.Mock;
const mockRemoveExerciseFromWorkout = removeExerciseFromWorkout as jest.Mock;
const mockReorderExercises = reorderExercises as jest.Mock;
const mockCompleteWorkout = completeWorkout as jest.Mock;
const mockCancelWorkout = cancelWorkout as jest.Mock;
const mockFetchPreviousPerformance = fetchPreviousPerformance as jest.Mock;

const mockGoBack = jest.fn();
const mockReset = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, reset: mockReset, navigate: mockNavigate };
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
  mockFetchPreviousPerformance.mockReset().mockResolvedValue(null);
  mockCancelWorkout.mockReset().mockResolvedValue(undefined);
  mockGoBack.mockClear();
  mockReset.mockClear();
  mockNavigate.mockClear();
});

describe('ActiveWorkoutScreen', () => {
  it('loads the workout for the given workoutId (resuming the correct session)', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    await waitFor(() => expect(mockFetchWorkoutDetail).toHaveBeenCalledWith('w1'));
    expect((await screen.findAllByText('Push Day')).length).toBeGreaterThan(0);
  });

  it('shows the muscle group from real exercise data, not hardcoded', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    const card = await screen.findByTestId('exercise-card-we1');
    expect(within(card).getByText('Chest')).toBeTruthy();
  });

  it('never renders RIR, RPE, estimated calories, or an exercise image', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    expect(screen.queryByText(/RIR/i)).toBeNull();
    expect(screen.queryByText(/RPE/i)).toBeNull();
    expect(screen.queryByText(/calor/i)).toBeNull();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('shows Total Sets reflecting every set that exists, including an incomplete one', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    expect(await screen.findByTestId('workout-summary-total-sets')).toHaveTextContent('2');
  });

  it('shows Total Volume reflecting only logged (completed) sets', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    // Only s1 (100kg x 10) is completed; s2 is blank and contributes 0.
    expect(await screen.findByTestId('workout-summary-total-volume')).toHaveTextContent('1000 kg');
  });

  it('completing a set requires a valid weight and reps first', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    const completeButton = screen.getByTestId('exercise-card-we1-set-s2-complete');
    expect(completeButton.props.accessibilityState.disabled).toBe(true);
  });

  it('marks a set complete once weight and reps are entered, using the existing set-update path', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
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

  it('accepts a .5 weight increment', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), '100.5');
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '6');

    expect(
      screen.getByTestId('exercise-card-we1-set-s2-complete').props.accessibilityState.disabled,
    ).toBe(false);
  });

  it('rejects arbitrary decimal precision -- only whole numbers or .5 increments are a valid weight', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    for (const invalid of ['100.1', '100.25', '100.75']) {
      fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), invalid);
      fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '6');
      expect(
        screen.getByTestId('exercise-card-we1-set-s2-complete').props.accessibilityState.disabled,
      ).toBe(true);
    }

    fireEvent.press(screen.getByTestId('exercise-card-we1-set-s2-complete'));
    expect(mockUpdateSet).not.toHaveBeenCalledWith(
      's2',
      expect.objectContaining({ completedAt: expect.any(String) }),
    );
  });

  it('Total Sets increases by exactly one when Add Set is pressed', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');
    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('2');

    fireEvent.press(screen.getByTestId('exercise-card-we1-add-set'));

    await waitFor(() => expect(mockCreateSet).toHaveBeenCalledWith('we1', 3));
    expect(await screen.findByTestId('exercise-card-we1-set-s3')).toBeTruthy();
    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('3');
  });

  it('removes an exercise using the existing soft-delete function', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
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

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
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
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
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

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we2');

    fireEvent.press(screen.getByTestId('exercise-card-we2-move-up'));

    await waitFor(() =>
      expect(mockReorderExercises).toHaveBeenCalledWith([
        { id: 'we2', workoutId: 'w1', exerciseId: 'ex2', orderIndex: 1 },
        { id: 'we1', workoutId: 'w1', exerciseId: 'ex1', orderIndex: 2 },
      ]),
    );
  });

  it('uses the centralized Workout accent theme, even when the profile still has a saved custom color', async () => {
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

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    // A completed set's check button is filled with the mode accent -- the
    // fixed default (app-wide black-and-white), not the saved custom color.
    const complete = await screen.findByTestId('exercise-card-we1-set-s1-complete');
    expect(StyleSheet.flatten(complete.props.style).backgroundColor).toBe(DEFAULT_WORKOUT_COLOR);
  });

  it('has no back arrow or "..." options menu -- Finish Workout/Cancel Workout are the only exits', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    expect(screen.queryByTestId('workout-header-back')).toBeNull();
    expect(screen.queryByTestId('workout-header-options')).toBeNull();
    expect(within(screen.getByTestId('active-workout-header')).getByText('Push Day')).toBeTruthy();
  });

  it('shows a prominent Finish Workout button that completes the workout via the same existing completeWorkout function -- exactly once, no duplicate record', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    const button = screen.getByTestId('complete-workout');
    expect(button).toHaveTextContent('Finish Workout');
    expect(screen.queryByText('Workout Complete')).toBeNull();

    fireEvent.press(button);

    await waitFor(() => expect(mockCompleteWorkout).toHaveBeenCalledWith('w1'));
    expect(mockCompleteWorkout).toHaveBeenCalledTimes(1);
    // Straight to the Share screen (History stays underneath it).
    expect(mockReset).toHaveBeenCalledWith({
      index: 1,
      routes: [{ name: 'WorkoutHistory' }, { name: 'ShareWorkout', params: { workoutId: 'w1' } }],
    });
    expect(mockCancelWorkout).not.toHaveBeenCalled();
  });

  it('the Finish Workout button follows the fixed Workout accent, even when the profile still has a saved custom color', async () => {
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

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    const button = screen.getByTestId('complete-workout');
    const flat = StyleSheet.flatten(button.props.style);
    expect(flat.backgroundColor).toBe(DEFAULT_WORKOUT_COLOR);
  });

  it('is reachable without scrolling even with many exercises, and does not interfere with adding sets/exercises', async () => {
    const manyExercises = Array.from({ length: 15 }, (_, i) => ({
      id: `we${i}`,
      exerciseId: `ex${i}`,
      exerciseName: `Exercise ${i}`,
      muscleGroup: 'chest' as const,
      orderIndex: i,
      sets: [{ id: `s${i}`, setIndex: 1, weightKg: null, reps: null, completedAt: null }],
    }));
    mockFetchWorkoutDetail.mockResolvedValue({ ...baseWorkout, exercises: manyExercises });

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    // The footer button is a sibling of the ScrollView, not inside its
    // scrollable content, so it renders regardless of exercise count.
    expect(await screen.findByTestId('complete-workout')).toBeTruthy();
    expect(screen.getByTestId('active-workout-add-exercise')).toBeTruthy();
  });

  it('shows an error message when loading fails', async () => {
    mockFetchWorkoutDetail.mockRejectedValue(new Error('network error'));

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    expect(await screen.findByTestId('active-workout-error')).toHaveTextContent('network error');
  });
});

describe('ActiveWorkoutScreen unilateral exercises', () => {
  const unilateralWorkout = {
    ...baseWorkout,
    exercises: [
      {
        id: 'we-bss',
        exerciseId: 'ex-bss',
        exerciseName: 'Bulgarian Split Squat',
        muscleGroup: 'quadriceps' as const,
        movementType: 'unilateral' as const,
        loggingStyle: 'alternating' as const,
        orderIndex: 1,
        sets: [
          {
            id: 's-left',
            setIndex: 1,
            side: 'left' as const,
            weightKg: null,
            reps: null,
            completedAt: null,
          },
          {
            id: 's-right',
            setIndex: 1,
            side: 'right' as const,
            weightKg: null,
            reps: null,
            completedAt: null,
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    mockFetchWorkoutDetail.mockResolvedValue(unilateralWorkout);
  });

  it('shows the "weight is per side" note and Left/Right rows instead of a single weight/reps row', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );

    const card = await screen.findByTestId('exercise-card-we-bss');
    expect(within(card).getByTestId('exercise-card-we-bss-per-side-note')).toHaveTextContent(
      'Weight is per side',
    );
    expect(within(card).getByTestId('exercise-card-we-bss-set-1-left-weight')).toBeTruthy();
    expect(within(card).getByTestId('exercise-card-we-bss-set-1-right-weight')).toBeTruthy();
  });

  it('logs left and right performance independently, never combining them into one weight', async () => {
    mockUpdateSet.mockReset().mockImplementation(async (setId: string, updates: unknown) => ({
      id: setId,
      setIndex: 1,
      side: setId === 's-left' ? 'left' : 'right',
      weightKg: null,
      reps: null,
      completedAt: null,
      ...(updates as object),
    }));

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we-bss');

    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-left-weight'), '42.5');
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-left-reps'), '10');
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-right-weight'), '40');
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-right-reps'), '10');
    fireEvent.press(screen.getByTestId('exercise-card-we-bss-set-1-complete'));

    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's-left',
        expect.objectContaining({ weightKg: 42.5, reps: 10, completedAt: expect.any(String) }),
      ),
    );
    expect(mockUpdateSet).toHaveBeenCalledWith(
      's-right',
      expect.objectContaining({ weightKg: 40, reps: 10, completedAt: expect.any(String) }),
    );
    // Confirms each side's own real weight was sent -- never 42.5 + 40 = 82.5.
    expect(mockUpdateSet).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ weightKg: 82.5 }),
    );
  });

  it('keeps the set incomplete (and Complete disabled) until BOTH sides have valid values', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we-bss');

    const completeButton = screen.getByTestId('exercise-card-we-bss-set-1-complete');
    expect(completeButton.props.accessibilityState.disabled).toBe(true);

    // Only the left side filled in -- still incomplete.
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-left-weight'), '42.5');
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-left-reps'), '10');
    expect(
      screen.getByTestId('exercise-card-we-bss-set-1-complete').props.accessibilityState.disabled,
    ).toBe(true);

    fireEvent.press(completeButton);
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('creates a new set for a unilateral exercise as a left+right pair sharing the next set_index', async () => {
    mockCreateSet
      .mockReset()
      .mockImplementation(async (_weId: string, setIndex: number, side?: string) => ({
        id: side === 'left' ? 's-left-2' : 's-right-2',
        setIndex,
        side: side ?? null,
        weightKg: null,
        reps: null,
        completedAt: null,
      }));

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we-bss');

    fireEvent.press(screen.getByTestId('exercise-card-we-bss-add-set'));

    await waitFor(() => expect(mockCreateSet).toHaveBeenCalledWith('we-bss', 2, 'left'));
    expect(mockCreateSet).toHaveBeenCalledWith('we-bss', 2, 'right');
    expect(await screen.findByTestId('exercise-card-we-bss-set-2-left-weight')).toBeTruthy();
    expect(screen.getByTestId('exercise-card-we-bss-set-2-right-weight')).toBeTruthy();
  });

  it('adds a unilateral exercise from the picker, creating both a left and a right blank row for its first set', async () => {
    mockFetchExercises.mockResolvedValue({
      rows: [
        {
          id: 'ex-row',
          name: 'Single-Arm Dumbbell Row',
          muscleGroup: 'back',
          movementType: 'unilateral',
          loggingStyle: 'single_side',
          isActive: true,
          createdBy: null,
        },
      ],
      hasMore: false,
    });
    mockCreateSet
      .mockReset()
      .mockImplementation(async (weId: string, setIndex: number, side?: string) => ({
        id: side === 'left' ? 's-row-left' : 's-row-right',
        setIndex,
        side: side ?? null,
        weightKg: null,
        reps: null,
        completedAt: null,
      }));

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we-bss');

    fireEvent.press(screen.getByTestId('active-workout-add-exercise'));
    fireEvent.press(await screen.findByTestId('exercise-picker-item-ex-row'));

    await waitFor(() => expect(mockAddExerciseToWorkout).toHaveBeenCalledWith('w1', 'ex-row', 2));
    expect(mockCreateSet).toHaveBeenCalledWith('we2', 1, 'left');
    expect(mockCreateSet).toHaveBeenCalledWith('we2', 1, 'right');
    const card = await screen.findByTestId('exercise-card-we2');
    expect(within(card).getByTestId('exercise-card-we2-set-1-left-weight')).toBeTruthy();
    expect(within(card).getByTestId('exercise-card-we2-set-1-right-weight')).toBeTruthy();
  });
});

describe('Last Time You Did This', () => {
  // Explicitly removed from the live workout screen (was reintroducing
  // extra vertical content mid-workout) -- this guards it doesn't quietly
  // come back.
  it('does not render anywhere on the live workout screen', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    expect(screen.queryByTestId('active-workout-last-time')).toBeNull();
    expect(screen.queryByText('Last Time You Did This')).toBeNull();
    expect(screen.queryByText('Shown are your top sets from last time.')).toBeNull();
  });
});

describe('Cancel Workout', () => {
  it('asks for confirmation before cancelling', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('cancel-workout'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Cancel Workout',
      expect.stringContaining('discards the current workout'),
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel Workout', style: 'destructive' }),
      ]),
    );
    expect(mockCancelWorkout).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('does nothing when the confirmation is dismissed ("Keep Going")', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Keep Going')?.onPress?.();
    });
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('cancel-workout'));

    expect(mockCancelWorkout).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('soft-deletes the workout and returns to Feed on confirm -- never completing or advancing it', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Cancel Workout')?.onPress?.();
    });
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('cancel-workout'));

    await waitFor(() => expect(mockCancelWorkout).toHaveBeenCalledWith('w1'));
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Feed' }] });
    expect(mockCompleteWorkout).not.toHaveBeenCalled();
  });

  it('shows an error and stays on screen if cancelling fails', async () => {
    mockCancelWorkout.mockRejectedValue(new Error('network error'));
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Cancel Workout')?.onPress?.();
    });
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('cancel-workout'));

    expect(await screen.findByTestId('active-workout-error')).toHaveTextContent('network error');
    expect(mockReset).not.toHaveBeenCalled();
  });
});

describe('Create Custom Exercise from Add Exercise', () => {
  it('opens the full New Exercise screen from inside the picker, and reopens the picker with the new exercise addable after saving', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-add-exercise'));
    fireEvent.press(await screen.findByTestId('exercise-picker-create-custom'));

    // The picker closes and the full New Exercise screen (with the
    // Machine/Equipment section) replaces the active workout in its place.
    expect(screen.queryByTestId('exercise-picker-search')).toBeNull();
    expect(await screen.findByText('New Exercise')).toBeTruthy();
    expect(screen.getByText('Machine / Equipment')).toBeTruthy();

    mockCreateExercise.mockResolvedValue({ id: 'ex-new' });
    mockFetchExercises.mockResolvedValue({
      rows: [
        {
          id: 'ex-new',
          name: 'Cable Preacher Curl',
          muscleGroup: 'biceps',
          isActive: true,
          createdBy: 'user-1',
        },
      ],
      hasMore: false,
    });

    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Cable Preacher Curl');
    fireEvent.press(screen.getByTestId('muscle-group-chip-biceps'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    // Back in the picker, immediately able to add the exercise just created.
    fireEvent.press(await screen.findByTestId('exercise-picker-item-ex-new'));

    await waitFor(() => expect(mockAddExerciseToWorkout).toHaveBeenCalledWith('w1', 'ex-new', 2));
  });

  it('also opens the same full New Exercise screen from the standalone Create Custom button', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-create-custom'));

    expect(await screen.findByText('New Exercise')).toBeTruthy();
  });
});

describe('Last Workout', () => {
  it('shows no section for an exercise with no prior session', async () => {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    expect(mockFetchPreviousPerformance).toHaveBeenCalledWith('user-1', 'ex1', 'w1');
    expect(screen.queryByTestId('exercise-card-we1-previous-session')).toBeNull();
  });

  it('shows every set from the last completed session for an exercise already in the workout, not just the top one', async () => {
    mockFetchPreviousPerformance.mockResolvedValue({
      performedAt: '2026-01-05T00:00:00Z',
      sets: [
        { id: 'prev-1', setIndex: 1, weightKg: 100, reps: 5, completedAt: '...', side: null },
        { id: 'prev-2', setIndex: 2, weightKg: 97.5, reps: 5, completedAt: '...', side: null },
        { id: 'prev-3', setIndex: 3, weightKg: 95, reps: 6, completedAt: '...', side: null },
      ],
    });

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    const section = await screen.findByTestId('exercise-card-we1-previous-session');
    expect(section).toHaveTextContent(/Last Workout/);
    // In logged order, all 3 -- never capped or reduced to a single "top" set.
    expect(screen.getByTestId('exercise-card-we1-previous-set-1')).toHaveTextContent(/100 kg/);
    expect(screen.getByTestId('exercise-card-we1-previous-set-2')).toHaveTextContent(/97\.5 kg/);
    expect(screen.getByTestId('exercise-card-we1-previous-set-3')).toHaveTextContent(/95 kg/);
  });

  it('fetches and shows the previous session for a newly added exercise too, not just ones already in the workout', async () => {
    mockFetchExercises.mockResolvedValue({
      rows: [{ id: 'ex2', name: 'Barbell Back Squat', muscleGroup: 'quadriceps', isActive: true }],
      hasMore: false,
    });
    mockAddExerciseToWorkout.mockResolvedValue('we2');
    mockFetchPreviousPerformance.mockImplementation(
      async (_userId: string, exerciseId: string, _excludeWorkoutId: string) => {
        if (exerciseId === 'ex2') {
          return {
            performedAt: '2026-01-04T00:00:00Z',
            sets: [
              { id: 'prev-x', setIndex: 1, weightKg: 60, reps: 8, completedAt: '...', side: null },
            ],
          };
        }
        return null;
      },
    );

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-add-exercise'));
    fireEvent.press(await screen.findByTestId('exercise-picker-item-ex2'));

    await waitFor(() =>
      expect(mockFetchPreviousPerformance).toHaveBeenCalledWith('user-1', 'ex2', 'w1'),
    );
    const section = await screen.findByTestId('exercise-card-we2-previous-session');
    expect(section).toHaveTextContent(/60 kg/);
  });

  it("opens this exercise's Progress detail when View History is pressed", async () => {
    mockFetchPreviousPerformance.mockResolvedValue({
      performedAt: '2026-01-05T00:00:00Z',
      sets: [{ id: 'prev-1', setIndex: 1, weightKg: 100, reps: 5, completedAt: '...', side: null }],
    });

    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1-previous-session');

    fireEvent.press(screen.getByTestId('exercise-card-we1-view-history'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressExerciseDetail', {
      exerciseId: 'ex1',
      exerciseName: 'Barbell Bench Press',
    });
  });
});

describe('ActiveWorkoutScreen -- built for one-handed use between sets', () => {
  const twoExercises = {
    ...baseWorkout,
    exercises: [
      ...baseWorkout.exercises,
      {
        id: 'we2',
        exerciseId: 'ex2',
        exerciseName: 'Overhead Press',
        muscleGroup: 'shoulders' as const,
        orderIndex: 2,
        sets: [{ id: 's9', setIndex: 1, weightKg: null, reps: null, completedAt: null }],
      },
    ],
  };

  async function renderReady() {
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1');
  }

  it('shows exercises as plain blocks, in no cards', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(twoExercises);
    await renderReady();

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(0);
  });

  it('separates exercises with a hairline, none above the first', async () => {
    mockFetchWorkoutDetail.mockResolvedValue(twoExercises);
    await renderReady();

    const first = StyleSheet.flatten(screen.getByTestId('exercise-card-we1').props.style);
    const second = StyleSheet.flatten(screen.getByTestId('exercise-card-we2').props.style);
    expect(first.borderTopWidth).toBeUndefined();
    expect(second.borderTopWidth).toBe(StyleSheet.hairlineWidth);
  });

  it('shows the workout name and its muscles in the header', async () => {
    await renderReady();

    const header = within(screen.getByTestId('active-workout-header'));
    expect(header.getByText('Push Day')).toBeTruthy();
    expect(header.getByText('Chest')).toBeTruthy();
  });

  it('pins duration, sets and volume outside the scrolling list so they stay in view', async () => {
    await renderReady();

    const scroll = within(screen.UNSAFE_getByType(ScrollView));
    expect(scroll.queryByTestId('active-workout-summary')).toBeNull();
    expect(screen.getByTestId('workout-summary-duration')).toBeTruthy();
    expect(screen.getByTestId('workout-summary-total-sets')).toBeTruthy();
    expect(screen.getByTestId('workout-summary-total-volume')).toBeTruthy();
  });

  it('has exactly one filled button -- Finish Workout -- pinned outside the scrolling list', async () => {
    await renderReady();

    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    const scroll = within(screen.UNSAFE_getByType(ScrollView));
    expect(scroll.queryByTestId('complete-workout')).toBeNull();
    expect(screen.getByTestId('complete-workout')).toHaveTextContent('Finish Workout');
  });

  it('keeps Cancel Workout quiet: destructive text at the end of the list, away from Finish', async () => {
    await renderReady();

    const cancel = screen.getByTestId('cancel-workout');
    expect(within(screen.UNSAFE_getByType(ScrollView)).getByTestId('cancel-workout')).toBe(cancel);
    expect(StyleSheet.flatten(cancel.props.style).borderWidth).toBeUndefined();
    expect(StyleSheet.flatten(within(cancel).getByText('Cancel Workout').props.style).color).toBe(
      colors.destructive,
    );
  });

  it('offers Add Exercise as a full-width secondary button and Create Custom as quiet text', async () => {
    await renderReady();

    const add = screen.getByTestId('active-workout-add-exercise');
    expect(screen.UNSAFE_queryAllByType(SecondaryButton).length).toBeGreaterThan(0);
    expect(StyleSheet.flatten(add.props.style).borderWidth).toBe(1);
    expect(add).toHaveTextContent('Add Exercise');
    const custom = screen.getByTestId('active-workout-create-custom');
    expect(StyleSheet.flatten(custom.props.style).borderWidth).toBeUndefined();
    expect(custom).toHaveTextContent('Create Custom Exercise');
  });

  it('makes each set input a large, named, mono readout and each complete button a 44pt target', async () => {
    await renderReady();

    const weight = screen.getByTestId('exercise-card-we1-set-s2-weight');
    const flat = StyleSheet.flatten(weight.props.style);
    expect(flat.height).toBeGreaterThanOrEqual(48);
    expect(flat.fontFamily).toBe(fonts.mono);
    expect(weight.props.accessibilityLabel).toBe('Set 2 weight');
    expect(screen.getByTestId('exercise-card-we1-set-s2-reps').props.accessibilityLabel).toBe(
      'Set 2 reps',
    );
    const complete = StyleSheet.flatten(
      screen.getByTestId('exercise-card-we1-set-s2-complete').props.style,
    );
    expect(complete.width).toBeGreaterThanOrEqual(44);
    expect(complete.height).toBeGreaterThanOrEqual(44);
  });

  it('avoids the on-screen keyboard so the set being typed stays visible', async () => {
    await renderReady();

    expect(screen.UNSAFE_getAllByType(KeyboardAvoidingView).length).toBeGreaterThan(0);
  });

  it('shows the last session as plain text beside the sets -- all of it visible, none behind a horizontal scroll', async () => {
    mockFetchPreviousPerformance.mockResolvedValue({
      performedAt: '2026-01-05T00:00:00Z',
      sets: [
        { id: 'p1', setIndex: 1, weightKg: 100, reps: 5, completedAt: '...', side: null },
        { id: 'p2', setIndex: 2, weightKg: 97.5, reps: 5, completedAt: '...', side: null },
      ],
    });
    await renderReady();

    await screen.findByTestId('exercise-card-we1-previous-session');
    expect(screen.getByTestId('exercise-card-we1-previous-set-1')).toHaveTextContent(/100 kg × 5$/);
    expect(screen.getByTestId('exercise-card-we1-previous-set-2')).toHaveTextContent(
      /97.5 kg × 5$/,
    );
    expect(
      screen.UNSAFE_queryAllByType(ScrollView).filter((node) => node.props.horizontal),
    ).toHaveLength(0);
  });
});

describe('ActiveWorkoutScreen renders no bare text outside <Text>', () => {
  it('has no string directly inside a View, with a previous session shown', async () => {
    mockFetchPreviousPerformance.mockResolvedValue({
      performedAt: '2026-01-05T00:00:00Z',
      sets: [{ id: 'p1', setIndex: 1, weightKg: 100, reps: 5, completedAt: '...', side: 'left' }],
    });
    render(
      <BackgroundThemeProvider>
        <ActiveWorkoutScreen navigation={navigation} route={route} />
      </BackgroundThemeProvider>,
    );
    await screen.findByTestId('exercise-card-we1-previous-session');

    expectNoBareText();
  });
});
