import type { PropsWithChildren } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { fetchExerciseSettings, saveExerciseSetting } from '../workouts/exerciseSettingsQueries';
import { useAuth } from '../auth/AuthProvider';
import { clearLiveWorkoutDraft } from '../workouts/liveWorkoutDraft';
import { AppCard } from '../design/AppCard';
import { Card } from '../design/Card';
import { PrimaryButton, SecondaryButton } from '../design/Button';
import { colors, fonts } from '../design/theme';
import { ProfileProvider } from '../profile/ProfileProvider';
import { AllTimeStatsProvider } from '../progress/AllTimeStatsProvider';
import { fetchAllCompletedWorkouts } from '../progress/progressStatsQueries';
import { createExercise, updateMyProfile } from '../lib/api';
import { fetchAllExercises } from '../exercises/exerciseQueries';
import {
  addCardio,
  deleteCardio,
  fetchRecentCardioActivities,
  settleStrengthTime,
  updateCardio,
} from '../cardio/cardioQueries';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { fetchAllOneRepMaxes, fetchAllRepPRs } from '../workouts/prSummaryQueries';
import {
  addExerciseToWorkout,
  cancelWorkout,
  completeWorkout,
  createSet,
  deleteSet,
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  moveSets,
  removeExerciseFromWorkout,
  reorderExercises,
  updateSet,
  fetchNextExerciseOrderIndex,
} from '../workouts/workoutQueries';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { widgetShown } from '../testUtils/widgetShown';
import { clearSetTimers, stopSetTimer } from '../workouts/setTimers';
import { recallLiveWorkout } from '../feed/liveWorkoutMemory';
import { isGuided } from '../workouts/guidedWorkout';
import { fetchDayPlan } from '../workouts/splitPlanQueries';
import { forgetShown } from '../lib/lastShown';
import { homeWidgets } from '../widgets/homeWidgets';
import { refreshNextWorkout } from '../widgets/nextWorkoutRefresh';
import { endWorkoutActivities } from '../widgets/workoutActivity';
import { ActiveWorkoutScreen } from './ActiveWorkoutScreen';
import { fetchMyProfile } from '../profile/profileQueries';
import { DEFAULT_WORKOUT_COLOR } from '../theme/accentColor';

const { nextWorkoutWidget, workoutActivity } = homeWidgets();

// completeWorkout is the one thing that invalidates AllTimeStatsProvider's
// shared cache (see that provider's own comment) -- present so it fetches
// something rather than hitting the real, unmocked supabase client.
function TestProviders({ children }: PropsWithChildren) {
  return (
    <ProfileProvider>
      <AllTimeStatsProvider>{children}</AllTimeStatsProvider>
    </ProfileProvider>
  );
}

// Nothing shared with this person: their own library only (see useSharedExercises' own tests).
jest.mock('../exercises/useSharedExercises', () => {
  const none = { rows: [], error: null, reload: () => {}, makeOwn: async (e: unknown) => e };
  return { useSharedExercises: () => none };
});

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
  createExercise: jest.fn(),
  updateExercise: jest.fn(),
  createEquipmentProfile: jest.fn(),
}));

jest.mock('../widgets/nextWorkoutRefresh', () => ({ refreshNextWorkout: jest.fn() }));
jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

jest.mock('../lib/equipmentPhotoUpload', () => ({
  uploadEquipmentPhoto: jest.fn(),
}));

jest.mock('../exercises/exerciseQueries', () => ({
  fetchAllExercises: jest.fn(),
  invalidateExerciseCache: jest.fn(),
  fetchExerciseSourceCounts: jest.fn().mockResolvedValue({ all: 0, builtin: 0, mine: 0 }),
}));

jest.mock('../workouts/exerciseSettingsQueries', () => ({
  fetchExerciseSettings: jest.fn(),
  saveExerciseSetting: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutDetail: jest.fn(),
  fetchNextExerciseOrderIndex: jest.fn(),
  createSet: jest.fn(),
  updateSet: jest.fn(),
  addExerciseToWorkout: jest.fn(),
  removeExerciseFromWorkout: jest.fn(),
  deleteSet: jest.fn(),
  reorderExercises: jest.fn(),
  completeWorkout: jest.fn(),
  cancelWorkout: jest.fn(),
  fetchPreviousPerformance: jest.fn(),
  moveSets: jest.fn(),
}));

// A workout's cardio (cardio/cardioQueries.ts): saved straight away, like sets.
jest.mock('../cardio/cardioQueries', () => ({
  addCardio: jest.fn(),
  updateCardio: jest.fn(),
  deleteCardio: jest.fn(),
  settleStrengthTime: jest.fn(),
  fetchRecentCardioActivities: jest.fn(),
}));

jest.mock('../progress/progressStatsQueries', () => ({
  fetchAllCompletedWorkouts: jest.fn(),
}));

// A planned day's plan (guided workouts); none unless a test gives one.
jest.mock('../workouts/splitPlanQueries', () => ({
  fetchDayPlan: jest.fn().mockResolvedValue([]),
}));

jest.mock('../workouts/guidedWorkout', () => ({
  ...jest.requireActual('../workouts/guidedWorkout'),
  isGuided: jest.fn().mockResolvedValue(false),
  forgetGuided: jest.fn().mockResolvedValue(undefined),
  markGuided: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../workouts/allExerciseHistoryQueries', () => ({
  fetchAllExerciseHistory: jest.fn(),
}));

jest.mock('../workouts/prSummaryQueries', () => ({
  fetchAllExerciseRecords: jest.fn().mockResolvedValue([]),
  fetchAllRepPRs: jest.fn(),
  fetchAllOneRepMaxes: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockCreateExercise = createExercise as jest.Mock;
const mockFetchExercises = fetchAllExercises as jest.Mock;
const mockFetchWorkoutDetail = fetchWorkoutDetail as jest.Mock;

/** From here, the workout as saved has a finished set -- what Finish reads before saving it. */
function savedWithAFinishedSet() {
  mockFetchWorkoutDetail.mockResolvedValue({
    ...baseWorkout,
    exercises: [
      {
        id: 'we-done',
        exerciseId: 'ex-done',
        exerciseName: 'Bench Press',
        photoUrl: null,
        muscleGroup: 'chest',
        movementType: 'bilateral',
        loggingStyle: null,
        orderIndex: 1,
        sets: [
          {
            id: 's-done',
            setIndex: 1,
            weightKg: 100,
            reps: 5,
            completedAt: '2026-01-01T00:10:00Z',
          },
        ],
      },
    ],
  });
}
const mockCreateSet = createSet as jest.Mock;
const mockUpdateSet = updateSet as jest.Mock;
const mockAddExerciseToWorkout = addExerciseToWorkout as jest.Mock;
const mockFetchNextExerciseOrderIndex = fetchNextExerciseOrderIndex as jest.Mock;
const mockRemoveExerciseFromWorkout = removeExerciseFromWorkout as jest.Mock;
const mockDeleteSet = deleteSet as jest.Mock;
const mockReorderExercises = reorderExercises as jest.Mock;
const mockCompleteWorkout = completeWorkout as jest.Mock;
const mockCancelWorkout = cancelWorkout as jest.Mock;
const mockFetchPreviousPerformance = fetchPreviousPerformance as jest.Mock;
const mockFetchAllCompletedWorkouts = fetchAllCompletedWorkouts as jest.Mock;
const mockFetchAllExerciseHistory = fetchAllExerciseHistory as jest.Mock;
const mockFetchAllRepPRs = fetchAllRepPRs as jest.Mock;
const mockFetchAllOneRepMaxes = fetchAllOneRepMaxes as jest.Mock;

const mockGoBack = jest.fn();
const mockReset = jest.fn();
const mockNavigate = jest.fn();
const mockReplace = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  goBack: mockGoBack,
  reset: mockReset,
  navigate: mockNavigate,
  replace: mockReplace,
};
const route = { params: { workoutId: 'w1' } } as never;

/** A 30-minute walk, already logged. */
const walk = {
  id: 'c9',
  workoutId: 'w1',
  activity: 'walking' as const,
  name: null,
  durationSeconds: 1800,
  distanceM: 3200,
  speedKmh: null,
  speedSetting: null,
  inclinePercent: null,
  resistanceLevel: null,
  floors: null,
  steps: null,
  strokeRate: null,
  poolLengthM: null,
  laps: null,
  notes: null,
  afterStrength: false,
  createdAt: '2026-01-01T00:01:00Z',
};

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

beforeEach(async () => {
  // What a test typed into a set is kept on the device for the workout; each test starts clean.
  await clearLiveWorkoutDraft('w1');
  (fetchRecentCardioActivities as jest.Mock).mockReset().mockResolvedValue([]);
  (settleStrengthTime as jest.Mock).mockReset().mockResolvedValue(undefined);
  (fetchExerciseSettings as jest.Mock).mockReset().mockResolvedValue(new Map());
  (saveExerciseSetting as jest.Mock).mockReset();
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockFetchMyProfile.mockReset().mockResolvedValue({
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
  mockFetchExercises.mockReset().mockResolvedValue([]);
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
  mockFetchNextExerciseOrderIndex.mockReset().mockResolvedValue(2);
  mockRemoveExerciseFromWorkout.mockReset().mockResolvedValue(undefined);
  mockDeleteSet.mockReset().mockResolvedValue(undefined);
  mockReorderExercises.mockReset().mockResolvedValue(undefined);
  mockCompleteWorkout.mockReset().mockResolvedValue(undefined);
  mockFetchPreviousPerformance.mockReset().mockResolvedValue(null);
  mockCancelWorkout.mockReset().mockResolvedValue(undefined);
  mockFetchAllCompletedWorkouts.mockReset().mockResolvedValue([]);
  mockFetchAllExerciseHistory.mockReset().mockResolvedValue([]);
  mockFetchAllRepPRs.mockReset().mockResolvedValue([]);
  mockFetchAllOneRepMaxes.mockReset().mockResolvedValue([]);
  mockGoBack.mockClear();
  mockReset.mockClear();
  mockNavigate.mockClear();
  mockReplace.mockClear();
});

/** The scrolling list of exercises -- not the muscle tabs, which scroll sideways above it. */
function exerciseList() {
  const lists = screen.UNSAFE_getAllByType(ScrollView).filter((list) => !list.props.horizontal);
  expect(lists).toHaveLength(1);
  return lists[0];
}

/** Says yes to Finish's question, and answers the one about sets left empty: removes them and finishes. */
function removeEmptySetsOnFinish() {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons
      ?.find((button) => /^(Finish Workout|Remove .* and Finish)$/.test(button.text ?? ''))
      ?.onPress?.();
  });
}

/** Says yes to Finish's question, "Finish Workout?". */
function confirmFinish() {
  return jest.spyOn(Alert, 'alert').mockImplementation((title, _message, buttons) => {
    if (title === 'Finish Workout?') {
      buttons?.find((button) => button.text === 'Finish Workout')?.onPress?.();
    }
  });
}

/** Waits out a set's save delay (useSetAutosave), for checking nothing was saved. */
async function pastTheSaveDelay() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
  });
}

describe('ActiveWorkoutScreen', () => {
  it('never saves a workout with nothing finished in it -- Finish offers to discard it', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({ ...baseWorkout, exercises: [] });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((title, _message, buttons) => {
      if (title === 'Finish Workout?') {
        buttons?.find((button) => button.text === 'Finish Workout')?.onPress?.();
      }
      if (title === 'Nothing logged yet') {
        buttons?.find((button) => button.text === 'Discard Workout')?.onPress?.();
      }
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('complete-workout');

    fireEvent.press(screen.getByTestId('complete-workout'));

    await waitFor(() => expect(mockCancelWorkout).toHaveBeenCalledWith('w1'));
    expect(alert).toHaveBeenCalledWith('Nothing logged yet', expect.any(String), expect.any(Array));
    expect(mockCompleteWorkout).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('asks before finishing, and Keep Going leaves the workout open', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Keep Going')?.onPress?.();
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('complete-workout'));

    // Just whether to finish -- never a question about cardio.
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledWith(
      'Finish Workout?',
      'Are you sure you want to finish this workout?',
      [
        expect.objectContaining({ text: 'Keep Going' }),
        expect.objectContaining({ text: 'Finish Workout' }),
      ],
    );
    await pastTheSaveDelay();
    expect(mockCompleteWorkout).not.toHaveBeenCalled();
    expect(screen.getByTestId('complete-workout')).toHaveTextContent('Finish Workout');
    alert.mockRestore();
  });

  it('loads the workout for the given workoutId (resuming the correct session)', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    await waitFor(() => expect(mockFetchWorkoutDetail).toHaveBeenCalledWith('w1'));
    expect((await screen.findAllByText('Push Day')).length).toBeGreaterThan(0);
  });

  it('shows the muscle group from real exercise data, not hardcoded', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    const card = await screen.findByTestId('exercise-card-we1');
    expect(within(card).getByText('Chest')).toBeTruthy();
  });

  it('never renders RIR, RPE, estimated calories, or an exercise image', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    expect(screen.queryByText(/RIR/i)).toBeNull();
    expect(screen.queryByText(/RPE/i)).toBeNull();
    expect(screen.queryByText(/calor/i)).toBeNull();
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('shows Total Sets reflecting every set that exists, including an incomplete one', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    expect(await screen.findByTestId('workout-summary-total-sets')).toHaveTextContent('2');
  });

  it('shows the number of exercises added so far, not total volume', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    expect(await screen.findByTestId('workout-summary-total-exercises')).toHaveTextContent('1');
    expect(screen.queryByTestId('workout-summary-total-volume')).toBeNull();
  });

  it('marks a set a warm-up from its number -- a W, saved at once -- and a working set again', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    const number = screen.getByTestId('exercise-card-we1-set-s1-number');
    expect(number).toHaveTextContent('1');
    fireEvent.press(number);

    expect(screen.getByTestId('exercise-card-we1-set-s1-number')).toHaveTextContent('W');
    await waitFor(() => expect(mockUpdateSet).toHaveBeenCalledWith('s1', { isWarmup: true }));

    fireEvent.press(screen.getByTestId('exercise-card-we1-set-s1-number'));
    expect(screen.getByTestId('exercise-card-we1-set-s1-number')).toHaveTextContent('1');
    await waitFor(() => expect(mockUpdateSet).toHaveBeenCalledWith('s1', { isWarmup: false }));
  });

  it('adds a drop set under the set just done -- the empty set waiting below moves down one', async () => {
    (moveSets as jest.Mock).mockReset().mockResolvedValue(undefined);
    mockCreateSet.mockResolvedValue({
      id: 'd1',
      setIndex: 2,
      side: null,
      weightKg: null,
      reps: null,
      completedAt: null,
      isDrop: true,
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('exercise-card-we1-add-drop-set'));

    await waitFor(() =>
      expect(mockCreateSet).toHaveBeenCalledWith('we1', 2, undefined, { isDrop: true }),
    );
    expect(moveSets).toHaveBeenCalledWith([{ id: 's2', setIndex: 3 }]);
    // Under set 1 with no number of its own; the empty set is still set 2, and the drop is part
    // of set 1, never a set of its own.
    expect(await screen.findByTestId('exercise-card-we1-set-d1-drop')).toHaveProp(
      'accessibilityLabel',
      'Drop set, set 1',
    );
    expect(screen.getByTestId('exercise-card-we1-set-s2-number')).toHaveTextContent('2');
    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('2');
  });

  it('offers no Drop Set until a set is filled in to drop from', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      exercises: [{ ...baseWorkout.exercises[0], sets: [baseWorkout.exercises[0].sets[1]] }],
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    expect(screen.queryByTestId('exercise-card-we1-add-drop-set')).toBeNull();
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), '80');
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '8');
    expect(screen.getByTestId('exercise-card-we1-add-drop-set')).toBeTruthy();
  });

  it('removes a set together with the drop sets under it, asking first', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      exercises: [
        {
          ...baseWorkout.exercises[0],
          sets: [
            baseWorkout.exercises[0].sets[0],
            {
              id: 'd1',
              setIndex: 2,
              weightKg: 75,
              reps: 9,
              completedAt: '2026-01-01T00:06:00Z',
              isDrop: true,
            },
            { ...baseWorkout.exercises[0].sets[1], setIndex: 3 },
          ],
        },
      ],
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.style === 'destructive')?.onPress?.();
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1-set-d1');

    fireEvent.press(screen.getByTestId('exercise-card-we1-set-s1-remove'));

    expect(alert.mock.calls[0][0]).toBe('Remove set 1 and its drop sets?');
    await waitFor(() => expect(mockDeleteSet).toHaveBeenCalledWith('d1'));
    expect(mockDeleteSet).toHaveBeenCalledWith('s1');
    expect(mockDeleteSet).not.toHaveBeenCalledWith('s2');
    await waitFor(() => expect(screen.queryByTestId('exercise-card-we1-set-d1')).toBeNull());
    alert.mockRestore();
  });

  it('adds cardio from the slim line at the top -- an activity tile, then its figures -- and changes it', async () => {
    (fetchRecentCardioActivities as jest.Mock).mockResolvedValue(['rowing']);
    (addCardio as jest.Mock).mockReset().mockImplementation(async (workoutId, values) => ({
      ...values,
      id: 'c1',
      workoutId,
      afterStrength: false,
      createdAt: '2026-01-01T00:10:00Z',
    }));
    (updateCardio as jest.Mock).mockReset().mockImplementation(async (id, values) => ({
      ...values,
      id,
      workoutId: 'w1',
      afterStrength: false,
      createdAt: '2026-01-01T00:10:00Z',
    }));
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    // In the workout's own widget, pinned above the exercises.
    const hero = within(await screen.findByTestId('active-workout-hero'));
    expect(hero.getByTestId('active-workout-cardio')).toBeTruthy();

    fireEvent.press(screen.getByTestId('active-workout-cardio-add'));
    // The activities first, what was done last leading; a tap goes straight to its figures.
    const tiles = within(screen.getByTestId('active-workout-cardio-sheet-activities'));
    expect(
      tiles
        .getAllByRole('button')
        .map((tile) => tile.props.accessibilityLabel)
        .slice(0, 2),
    ).toEqual(['Rowing', 'Treadmill']);
    fireEvent.press(screen.getByTestId('active-workout-cardio-sheet-activity-treadmill'));
    expect(screen.getByTestId('active-workout-cardio-sheet-activity')).toHaveTextContent(
      'Treadmill',
    );
    // Its own figures only: no calories, and nothing a treadmill doesn't have.
    expect(screen.queryByTestId('active-workout-cardio-sheet-calories')).toBeNull();
    expect(screen.queryByTestId('active-workout-cardio-sheet-laps')).toBeNull();

    // A time is the one thing it needs, said on the field.
    fireEvent.press(screen.getByTestId('active-workout-cardio-sheet-save'));
    expect(
      await screen.findByTestId('active-workout-cardio-sheet-duration-error'),
    ).toHaveTextContent(/how long it took/);
    fireEvent.changeText(screen.getByTestId('active-workout-cardio-sheet-duration'), '20');
    fireEvent.changeText(screen.getByTestId('active-workout-cardio-sheet-distance'), '3');
    fireEvent.changeText(screen.getByTestId('active-workout-cardio-sheet-speedSetting'), '6.5');
    // The incline nudged up twice from nothing.
    fireEvent.press(screen.getByTestId('active-workout-cardio-sheet-incline-up'));
    fireEvent.press(screen.getByTestId('active-workout-cardio-sheet-incline-up'));
    expect(screen.getByTestId('active-workout-cardio-sheet-incline')).toHaveProp('value', '1');
    fireEvent.press(screen.getByTestId('active-workout-cardio-sheet-save'));

    await waitFor(() =>
      expect(addCardio).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          activity: 'treadmill',
          durationSeconds: 1200,
          distanceM: 3000,
          speedSetting: 6.5,
          inclinePercent: 1,
          speedKmh: null,
        }),
      ),
    );
    expect(await screen.findByTestId('active-workout-cardio-entry-c1')).toHaveTextContent(
      'Treadmill · 20 min',
    );
    // Cardio is never a set: the workout still has its two.
    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('2');

    fireEvent.press(screen.getByTestId('active-workout-cardio-entry-c1'));
    expect(screen.getByTestId('active-workout-cardio-sheet-duration')).toHaveProp('value', '20');
    fireEvent.changeText(screen.getByTestId('active-workout-cardio-sheet-duration'), '25:30');
    fireEvent.press(screen.getByTestId('active-workout-cardio-sheet-save'));
    await waitFor(() =>
      expect(updateCardio).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ durationSeconds: 1530, speedSetting: 6.5 }),
      ),
    );
  });

  it('switches activity keeping what both ask for', async () => {
    (addCardio as jest.Mock).mockReset().mockImplementation(async (workoutId, values) => ({
      ...values,
      id: 'c5',
      workoutId,
      afterStrength: false,
      createdAt: '2026-01-01T00:10:00Z',
    }));
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    fireEvent.press(await screen.findByTestId('active-workout-cardio-add'));
    fireEvent.press(screen.getByTestId('active-workout-cardio-sheet-activity-treadmill'));
    fireEvent.changeText(screen.getByTestId('active-workout-cardio-sheet-duration'), '30');
    fireEvent.changeText(screen.getByTestId('active-workout-cardio-sheet-distance'), '5');
    fireEvent.changeText(screen.getByTestId('active-workout-cardio-sheet-incline'), '3');

    fireEvent.press(screen.getByTestId('active-workout-cardio-sheet-change'));
    fireEvent.press(screen.getByTestId('active-workout-cardio-sheet-activity-outdoor_run'));
    expect(screen.getByTestId('active-workout-cardio-sheet-duration')).toHaveProp('value', '30');
    expect(screen.getByTestId('active-workout-cardio-sheet-distance')).toHaveProp('value', '5');
    expect(screen.queryByTestId('active-workout-cardio-sheet-incline')).toBeNull();
    expect(screen.getByTestId('active-workout-cardio-sheet-readout')).toHaveTextContent(
      'Pace 6:00 /km · 10 km/h',
    );
    fireEvent.press(screen.getByTestId('active-workout-cardio-sheet-save'));
    await waitFor(() =>
      expect(addCardio).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          activity: 'outdoor_run',
          durationSeconds: 1800,
          distanceM: 5000,
          inclinePercent: null,
        }),
      ),
    );
  });

  it('removes a cardio activity from its sheet', async () => {
    (deleteCardio as jest.Mock).mockReset().mockResolvedValue(undefined);
    mockFetchWorkoutDetail.mockResolvedValue({ ...baseWorkout, cardio: [walk] });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    fireEvent.press(await screen.findByTestId('active-workout-cardio-entry-c9'));
    fireEvent.press(screen.getByTestId('active-workout-cardio-sheet-remove'));

    await waitFor(() => expect(deleteCardio).toHaveBeenCalledWith('c9'));
    await waitFor(() => expect(screen.queryByTestId('active-workout-cardio-entry-c9')).toBeNull());
    // Its sets are untouched.
    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('2');
  });

  it('finishes without a cardio question, working the strength part out from the last set', async () => {
    // A walk added before the last set (during the lifting), a row added after it.
    const row = {
      ...walk,
      id: 'c10',
      activity: 'rowing' as const,
      createdAt: '2026-01-01T00:40:00Z',
    };
    mockFetchWorkoutDetail.mockResolvedValue({ ...baseWorkout, cardio: [walk, row] });
    // Its empty second set is removed at Finish, as usual.
    const alert = removeEmptySetsOnFinish();
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('active-workout-cardio-entry-c10');

    fireEvent.press(screen.getByTestId('complete-workout'));

    await waitFor(() => expect(mockCompleteWorkout).toHaveBeenCalledWith('w1'));
    expect(alert).toHaveBeenCalledWith(
      'Finish Workout?',
      'Are you sure you want to finish this workout?',
      expect.any(Array),
    );
    // Nothing asked about cardio along the way.
    for (const [title, message] of alert.mock.calls) {
      expect(`${title} ${message ?? ''}`).not.toMatch(/cardio/i);
    }
    // The last set was finished at 0:05: the strength part ended there.
    expect(settleStrengthTime).toHaveBeenCalledWith('w1', '2026-01-01T00:05:00Z', [walk, row]);
    alert.mockRestore();
  });

  it('finishes a workout of cardio alone', async () => {
    const cardioOnly = { ...baseWorkout, exercises: [], cardio: [walk] };
    mockFetchWorkoutDetail.mockResolvedValue(cardioOnly);
    const alert = confirmFinish();
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('active-workout-cardio-entry-c9');

    fireEvent.press(screen.getByTestId('complete-workout'));

    await waitFor(() => expect(mockCompleteWorkout).toHaveBeenCalledWith('w1'));
    expect(alert).toHaveBeenCalledWith(
      'Finish Workout?',
      'Are you sure you want to finish this workout?',
      expect.any(Array),
    );
    // No set: no strength part to work out.
    expect(settleStrengthTime).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('tells you once how to mark a warm-up, on the first exercise, until you do or dismiss it', async () => {
    await AsyncStorage.removeItem('@progresso/warmupHintSeen');
    const { unmount } = render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    expect(await screen.findByTestId('exercise-card-we1-warmup-hint')).toHaveTextContent(
      /Tap a set’s number to mark it a warm-up/,
    );

    // Marking one is learning it: the tip goes, and stays gone.
    fireEvent.press(screen.getByTestId('exercise-card-we1-set-s1-number'));
    expect(screen.queryByTestId('exercise-card-we1-warmup-hint')).toBeNull();
    await waitFor(() => expect(mockUpdateSet).toHaveBeenCalledWith('s1', { isWarmup: true }));
    unmount();

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');
    expect(screen.queryByTestId('exercise-card-we1-warmup-hint')).toBeNull();
    await AsyncStorage.removeItem('@progresso/warmupHintSeen');
  });

  it('has no check to tap, and saves nothing until a set has a weight and reps', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    expect(screen.queryByTestId('exercise-card-we1-set-s2-complete')).toBeNull();
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), '120');
    await pastTheSaveDelay();
    expect(mockUpdateSet).not.toHaveBeenCalledWith('s2', expect.anything());
  });

  it('saves a set as its weight and reps are typed, using the existing set-update path', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), '120');
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '6');

    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's2',
        expect.objectContaining({ weightKg: 120, reps: 6, completedAt: expect.any(String) }),
      ),
    );

    // Changed, it saves again; the time it was done stays.
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '7');
    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenLastCalledWith(
        's2',
        expect.objectContaining({ weightKg: 120, reps: 7 }),
      ),
    );
  });

  it('saves a bodyweight set on reps alone, and no weight', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      exercises: [
        {
          ...baseWorkout.exercises[0],
          exerciseName: 'Push-Up',
          measurementType: 'bodyweight' as const,
          sets: [{ id: 's2', setIndex: 1, weightKg: null, reps: null, completedAt: null }],
        },
      ],
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    expect(screen.queryByTestId('exercise-card-we1-set-s2-weight')).toBeNull();
    expect(screen.getByTestId('exercise-card-we1-set-s2-bodyweight')).toHaveTextContent('BW');
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '20');

    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's2',
        expect.objectContaining({
          weightKg: null,
          reps: 20,
          durationSeconds: null,
          completedAt: expect.any(String),
        }),
      ),
    );
  });

  it('saves a timed set on a time typed as minutes and seconds', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      exercises: [
        {
          ...baseWorkout.exercises[0],
          exerciseName: 'Plank',
          muscleGroup: 'abs' as const,
          measurementType: 'timed' as const,
          sets: [{ id: 's2', setIndex: 1, weightKg: null, reps: null, completedAt: null }],
        },
      ],
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-time'), '1:30');

    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's2',
        expect.objectContaining({
          weightKg: null,
          reps: null,
          durationSeconds: 90,
          completedAt: expect.any(String),
        }),
      ),
    );
  });

  it('accepts a .5 weight increment', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), '100.5');
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '6');

    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's2',
        expect.objectContaining({ weightKg: 100.5 }),
      ),
    );
  });

  it('accepts weights in steps of 0.25, such as 61.25 with 1.25 kg plates', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    for (const valid of ['61.25', '100.75']) {
      fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), valid);
      fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '6');
      await waitFor(() =>
        expect(mockUpdateSet).toHaveBeenCalledWith(
          's2',
          expect.objectContaining({ weightKg: Number(valid) }),
        ),
      );
    }
  });

  it('rejects arbitrary decimal precision -- only steps of 0.25 are a valid weight', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    for (const invalid of ['100.1', '100.3', '100.125']) {
      fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), invalid);
      fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '6');
    }

    await pastTheSaveDelay();
    expect(mockUpdateSet).not.toHaveBeenCalledWith(
      's2',
      expect.objectContaining({ completedAt: expect.any(String) }),
    );
  });

  it('Total Sets increases by exactly one when Add Set is pressed', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');
    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('2');

    fireEvent.press(screen.getByTestId('exercise-card-we1-add-set'));

    await waitFor(() => expect(mockCreateSet).toHaveBeenCalledWith('we1', 3));
    expect(await screen.findByTestId('exercise-card-we1-set-s3')).toBeTruthy();
    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('3');
  });

  it('removes an exercise using the existing soft-delete function', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('exercise-card-we1-menu'));
    fireEvent.press(screen.getByTestId('exercise-card-we1-remove'));

    await waitFor(() => expect(mockRemoveExerciseFromWorkout).toHaveBeenCalledWith('we1'));
    expect(screen.queryByTestId('exercise-card-we1')).toBeNull();
  });

  it('removes a set using the existing soft-delete function, updating Total Sets', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1-set-s2');
    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('2');

    fireEvent.press(screen.getByTestId('exercise-card-we1-set-s2-remove'));

    await waitFor(() => expect(mockDeleteSet).toHaveBeenCalledWith('s2'));
    await waitFor(() => expect(screen.queryByTestId('exercise-card-we1-set-s2')).toBeNull());
    expect(screen.getByTestId('workout-summary-total-sets')).toHaveTextContent('1');
  });

  it('asks before removing a set that has been logged, and keeps it on Cancel', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1-set-s1');

    fireEvent.press(screen.getByTestId('exercise-card-we1-set-s1-remove'));

    expect(alert).toHaveBeenCalledWith(
      'Remove set 1?',
      'What you entered for it is removed from this workout.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Remove Set', style: 'destructive' }),
      ]),
    );
    expect(mockDeleteSet).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    await act(async () => {
      buttons.find((button) => button.text === 'Remove Set')!.onPress!();
    });
    expect(mockDeleteSet).toHaveBeenCalledWith('s1');
    alert.mockRestore();
  });

  it('numbers the sets left after a removal 1, 2, ... with no gap', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Remove Set')?.onPress?.();
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1-set-s2');
    expect(within(screen.getByTestId('exercise-card-we1-set-s2')).getByText('2')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByTestId('exercise-card-we1-set-s1-remove'));
    });

    await waitFor(() => expect(screen.queryByTestId('exercise-card-we1-set-s1')).toBeNull());
    expect(within(screen.getByTestId('exercise-card-we1-set-s2')).getByText('1')).toBeTruthy();
    (Alert.alert as jest.Mock).mockRestore();
  });

  it('adds an exercise mid-workout, which starts with exactly one blank set', async () => {
    mockFetchExercises.mockResolvedValue([
      {
        id: 'ex2',
        name: 'Barbell Back Squat',
        muscleGroup: 'quadriceps',
        isActive: true,
        createdBy: null,
      },
    ]);

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-add-exercise'));
    fireEvent.press(await screen.findByTestId('exercise-item-ex2'));

    await waitFor(() => expect(mockAddExerciseToWorkout).toHaveBeenCalledWith('w1', 'ex2', 2));
    expect(mockCreateSet).toHaveBeenCalledWith('we2', 1);
    const card = await screen.findByTestId('exercise-card-we2');
    expect(within(card).getByTestId('exercise-card-we2-set-s3')).toBeTruthy();
    expect(within(card).queryByTestId('exercise-card-we2-set-s3-2')).toBeNull();
  });

  describe('muscle tabs', () => {
    const exercise = (id: string, name: string, muscleGroup: string, orderIndex: number) => ({
      id,
      exerciseId: `ex-${id}`,
      exerciseName: name,
      muscleGroup,
      orderIndex,
      sets: [],
    });
    const SHOULDERS_AND_CHEST = {
      ...baseWorkout,
      exercises: [
        exercise('we1', 'Overhead Press', 'shoulders', 1),
        exercise('we2', 'Bench Press', 'chest', 2),
        exercise('we3', 'Lateral Raise', 'shoulders', 3),
      ],
    };

    async function open(workout: unknown) {
      mockFetchWorkoutDetail.mockResolvedValue(workout);
      render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
        wrapper: TestProviders,
      });
      await screen.findByTestId('exercise-card-we1');
    }

    it('has a tab for each primary muscle trained, in the order first added, and All', async () => {
      await open(SHOULDERS_AND_CHEST);

      const tabs = screen.getByTestId('active-workout-muscle-tabs');
      expect(within(tabs).getByTestId('active-workout-muscle-tabs-all')).toBeTruthy();
      expect(within(tabs).getByTestId('active-workout-muscle-tabs-shoulders')).toBeTruthy();
      expect(within(tabs).getByTestId('active-workout-muscle-tabs-chest')).toBeTruthy();
      // Nothing for a muscle no exercise here trains.
      expect(within(tabs).queryByTestId('active-workout-muscle-tabs-biceps')).toBeNull();
    });

    it("shows just one muscle's exercises on its tab, and every one on All", async () => {
      await open(SHOULDERS_AND_CHEST);

      fireEvent.press(screen.getByTestId('active-workout-muscle-tabs-shoulders'));
      expect(screen.getByTestId('exercise-card-we1')).toBeTruthy();
      expect(screen.getByTestId('exercise-card-we3')).toBeTruthy();
      expect(screen.queryByTestId('exercise-card-we2')).toBeNull();

      fireEvent.press(screen.getByTestId('active-workout-muscle-tabs-all'));
      expect(screen.getByTestId('exercise-card-we2')).toBeTruthy();
    });

    it('has no tabs before an exercise is added', async () => {
      mockFetchWorkoutDetail.mockResolvedValue({ ...baseWorkout, exercises: [] });
      render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
        wrapper: TestProviders,
      });
      await screen.findByTestId('active-workout-empty');
      expect(screen.queryByTestId('active-workout-muscle-tabs')).toBeNull();
    });

    it("adds a muscle's tab once an exercise for it is added, opening it from a muscle tab", async () => {
      mockFetchExercises.mockResolvedValue([
        { id: 'ex-curl', name: 'Barbell Curl', muscleGroup: 'biceps', isActive: true },
      ]);
      mockAddExerciseToWorkout.mockResolvedValue('we4');
      await open(SHOULDERS_AND_CHEST);
      fireEvent.press(screen.getByTestId('active-workout-muscle-tabs-shoulders'));

      fireEvent.press(screen.getByTestId('active-workout-add-exercise'));
      fireEvent.press(await screen.findByTestId('exercise-item-ex-curl'));

      expect(await screen.findByTestId('active-workout-muscle-tabs-biceps')).toBeTruthy();
      // The new exercise's tab, so it isn't added out of sight.
      expect(await screen.findByTestId('exercise-card-we4')).toBeTruthy();
      expect(screen.queryByTestId('exercise-card-we1')).toBeNull();
      expect(
        screen.getByTestId('active-workout-muscle-tabs-biceps').props.accessibilityState,
      ).toMatchObject({ selected: true });
    });

    it('moves an exercise past the one before it on its tab', async () => {
      await open(SHOULDERS_AND_CHEST);
      fireEvent.press(screen.getByTestId('active-workout-muscle-tabs-shoulders'));

      // On Shoulders, Lateral Raise's neighbour is Overhead Press, not the Bench Press between.
      fireEvent.press(screen.getByTestId('exercise-card-we3-menu'));
      fireEvent.press(screen.getByTestId('exercise-card-we3-move-up'));

      await waitFor(() =>
        expect(mockReorderExercises).toHaveBeenCalledWith([
          { id: 'we3', workoutId: 'w1', exerciseId: 'ex-we3', orderIndex: 1 },
          { id: 'we1', workoutId: 'w1', exerciseId: 'ex-we1', orderIndex: 3 },
        ]),
      );
    });
  });

  it('opens the existing custom-exercise creation flow', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
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

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we2');

    fireEvent.press(screen.getByTestId('exercise-card-we2-menu'));
    fireEvent.press(screen.getByTestId('exercise-card-we2-move-up'));

    await waitFor(() =>
      expect(mockReorderExercises).toHaveBeenCalledWith([
        { id: 'we2', workoutId: 'w1', exerciseId: 'ex2', orderIndex: 1 },
        { id: 'we1', workoutId: 'w1', exerciseId: 'ex1', orderIndex: 2 },
      ]),
    );
  });

  it("uses the theme's one accent, even if an old custom Workout color is saved on the account", async () => {
    mockFetchMyProfile.mockResolvedValue({
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

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    // The selected muscle tab is filled with the accent -- always the theme's, never a
    // color saved by the old color picker.
    const allTab = await screen.findByTestId('active-workout-muscle-tabs-all');
    expect(StyleSheet.flatten(allTab.props.style).backgroundColor).toBe(DEFAULT_WORKOUT_COLOR);
  });

  it('has no back arrow or "..." options menu -- Finish Workout/Cancel Workout are the only exits', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    expect(screen.queryByTestId('workout-header-back')).toBeNull();
    expect(screen.queryByTestId('workout-header-options')).toBeNull();
    expect(within(screen.getByTestId('active-workout-header')).getByText('Push Day')).toBeTruthy();
  });

  it('tells Feed it is going as soon as it opens, and that it is not once finished', async () => {
    forgetShown();
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    expect(recallLiveWorkout('user-1')).toMatchObject({ id: 'w1', completedAt: null });

    const alert = removeEmptySetsOnFinish();
    fireEvent.press(screen.getByTestId('complete-workout'));
    await waitFor(() => expect(mockCompleteWorkout).toHaveBeenCalledWith('w1'));
    await waitFor(() => expect(recallLiveWorkout('user-1')).toBeNull());
    alert.mockRestore();
  });

  it('is on the Lock Screen and the Next Workout widget while it goes, and off the Lock Screen once finished', async () => {
    await endWorkoutActivities();
    const start = workoutActivity.start as jest.Mock;
    start.mockClear();
    (refreshNextWorkout as jest.Mock).mockClear();
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    expect(start).toHaveBeenCalledWith(
      {
        title: 'Push Day',
        kind: 'Your workout',
        startedAt: Date.parse('2026-01-01T00:00:00Z'),
        accent: '#EBC27C',
      },
      'progresso://workouts/w1/live',
    );
    await waitFor(() =>
      expect(widgetShown(nextWorkoutWidget)).toMatchObject({
        eyebrow: 'Workout in Progress',
        title: 'Push Day',
      }),
    );

    const card = start.mock.results[0].value;
    (workoutActivity.getInstances as jest.Mock).mockReturnValueOnce([card]);
    const alert = removeEmptySetsOnFinish();
    fireEvent.press(screen.getByTestId('complete-workout'));

    await waitFor(() => expect(card.end).toHaveBeenCalledWith('immediate'));
    expect(refreshNextWorkout).toHaveBeenCalledWith('user-1', null);
    alert.mockRestore();
  });

  it('comes off the Lock Screen when it is cancelled too', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Cancel Workout')?.onPress?.();
    });
    await endWorkoutActivities();
    const start = workoutActivity.start as jest.Mock;
    start.mockClear();
    (refreshNextWorkout as jest.Mock).mockClear();
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');
    const card = start.mock.results[0].value;
    (workoutActivity.getInstances as jest.Mock).mockReturnValueOnce([card]);

    fireEvent.press(screen.getByTestId('cancel-workout'));

    await waitFor(() => expect(card.end).toHaveBeenCalledWith('immediate'));
    expect(refreshNextWorkout).toHaveBeenCalledWith('user-1', null);
  });

  it('shows a prominent Finish Workout button that completes the workout via the same existing completeWorkout function -- exactly once, no duplicate record', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    const button = screen.getByTestId('complete-workout');
    expect(button).toHaveTextContent('Finish Workout');
    expect(screen.queryByText('Workout Complete')).toBeNull();

    const alert = removeEmptySetsOnFinish();
    fireEvent.press(button);

    await waitFor(() => expect(mockCompleteWorkout).toHaveBeenCalledWith('w1'));
    expect(mockCompleteWorkout).toHaveBeenCalledTimes(1);
    // The set left empty was asked about, and removed.
    expect(alert).toHaveBeenCalledWith(
      'A set is missing a value',
      expect.stringContaining('Fill it in, or remove it and finish.'),
      expect.any(Array),
      expect.anything(),
    );
    expect(mockDeleteSet).toHaveBeenCalledWith('s2');
    alert.mockRestore();
    // Straight to the Share screen (History stays underneath it).
    expect(mockReset).toHaveBeenCalledWith({
      index: 1,
      routes: [
        { name: 'WorkoutHistory' },
        { name: 'ShareWorkout', params: { workoutId: 'w1', justFinished: true } },
      ],
    });
    expect(mockCancelWorkout).not.toHaveBeenCalled();
  });

  it('refetches the shared all-time stats cache after completing a workout, so Profile/Progress are current without their own fetch', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');
    await waitFor(() => expect(mockFetchAllCompletedWorkouts).toHaveBeenCalledTimes(1));

    const alert = removeEmptySetsOnFinish();
    fireEvent.press(screen.getByTestId('complete-workout'));

    await waitFor(() => expect(mockCompleteWorkout).toHaveBeenCalledWith('w1'));
    alert.mockRestore();
    // Cancelling a workout never sets completed_at, so it must never trigger
    // this refetch -- only completeWorkout invalidates the cache.
    await waitFor(() => expect(mockFetchAllCompletedWorkouts).toHaveBeenCalledTimes(2));
  });

  it('does not refetch the shared all-time stats cache when a workout is cancelled instead of completed', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Cancel Workout')?.onPress?.();
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');
    await waitFor(() => expect(mockFetchAllCompletedWorkouts).toHaveBeenCalledTimes(1));

    fireEvent.press(screen.getByTestId('cancel-workout'));

    await waitFor(() => expect(mockCancelWorkout).toHaveBeenCalledWith('w1'));
    expect(mockFetchAllCompletedWorkouts).toHaveBeenCalledTimes(1);
  });

  it("the Finish Workout button is in the theme's accent, even if an old custom Workout color is saved", async () => {
    mockFetchMyProfile.mockResolvedValue({
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

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
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

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    // The footer button is a sibling of the ScrollView, not inside its
    // scrollable content, so it renders regardless of exercise count.
    expect(await screen.findByTestId('complete-workout')).toBeTruthy();
    expect(screen.getByTestId('active-workout-add-exercise')).toBeTruthy();
  });

  it('opens the detail instead for a workout that was already finished, such as from an old link', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      completedAt: '2026-01-01T01:00:00Z',
    });

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w1' }),
    );
    // Never shown as live, so it can't be cancelled or finished again from here.
    expect(screen.queryByTestId('cancel-workout')).toBeNull();
    expect(screen.queryByTestId('complete-workout')).toBeNull();
  });

  it('shows an error message when loading fails', async () => {
    mockFetchWorkoutDetail.mockRejectedValue(new Error('network error'));

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

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
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

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

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we-bss');

    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-left-weight'), '42.5');
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-left-reps'), '10');
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-right-weight'), '40');
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-right-reps'), '10');

    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's-left',
        expect.objectContaining({ weightKg: 42.5, reps: 10, completedAt: expect.any(String) }),
      ),
    );
    // Each side saves as its own set, a moment after its own typing.
    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's-right',
        expect.objectContaining({ weightKg: 40, reps: 10, completedAt: expect.any(String) }),
      ),
    );
    // Confirms each side's own real weight was sent -- never 42.5 + 40 = 82.5.
    expect(mockUpdateSet).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ weightKg: 82.5 }),
    );
  });

  it('removes both sides of a unilateral set together, by the left side id', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we-bss-set-1-left-weight');

    fireEvent.press(screen.getByTestId('exercise-card-we-bss-set-1-remove'));

    await waitFor(() => expect(mockDeleteSet).toHaveBeenCalledWith('s-left'));
    expect(mockDeleteSet).toHaveBeenCalledWith('s-right');
    await waitFor(() =>
      expect(screen.queryByTestId('exercise-card-we-bss-set-1-left-weight')).toBeNull(),
    );
  });

  it('asks at Finish about a side left empty, and removes the whole set -- both sides', async () => {
    mockUpdateSet.mockImplementation(async (setId: string, updates: unknown) => ({
      id: setId,
      setIndex: 1,
      side: setId === 's-left' ? 'left' : 'right',
      weightKg: null,
      reps: null,
      completedAt: null,
      ...(updates as object),
    }));
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we-bss');

    // Only the left side filled in.
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-left-weight'), '42.5');
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-left-reps'), '10');
    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith('s-left', expect.objectContaining({ reps: 10 })),
    );
    expect(mockUpdateSet).not.toHaveBeenCalledWith('s-right', expect.anything());

    const alert = removeEmptySetsOnFinish();
    savedWithAFinishedSet();
    fireEvent.press(screen.getByTestId('complete-workout'));

    await waitFor(() => expect(mockCompleteWorkout).toHaveBeenCalledWith('w1'));
    expect(mockDeleteSet).toHaveBeenCalledWith('s-left');
    expect(mockDeleteSet).toHaveBeenCalledWith('s-right');
    alert.mockRestore();
  });

  it('keeps the workout open to fill in, when Fill In is chosen', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we-bss');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => /^(Finish Workout|Fill In)$/.test(button.text ?? ''))?.onPress?.();
    });

    fireEvent.press(screen.getByTestId('complete-workout'));

    expect(alert).toHaveBeenCalledWith(
      'Some sets are missing values',
      expect.any(String),
      expect.any(Array),
      expect.anything(),
    );
    await pastTheSaveDelay();
    expect(mockCompleteWorkout).not.toHaveBeenCalled();
    expect(mockDeleteSet).not.toHaveBeenCalled();
    alert.mockRestore();
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

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we-bss');

    fireEvent.press(screen.getByTestId('exercise-card-we-bss-add-set'));

    await waitFor(() => expect(mockCreateSet).toHaveBeenCalledWith('we-bss', 2, 'left'));
    expect(mockCreateSet).toHaveBeenCalledWith('we-bss', 2, 'right');
    expect(await screen.findByTestId('exercise-card-we-bss-set-2-left-weight')).toBeTruthy();
    expect(screen.getByTestId('exercise-card-we-bss-set-2-right-weight')).toBeTruthy();
  });

  it('starts both sides of a new unilateral set empty, whatever the set before it holds', async () => {
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

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we-bss');

    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-left-weight'), '42.5');
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-left-reps'), '10');
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-right-weight'), '40');
    fireEvent.changeText(screen.getByTestId('exercise-card-we-bss-set-1-right-reps'), '9');
    fireEvent.press(screen.getByTestId('exercise-card-we-bss-add-set'));

    const leftWeight = await screen.findByTestId('exercise-card-we-bss-set-2-left-weight');
    expect(leftWeight.props.value).toBe('');
    expect(screen.getByTestId('exercise-card-we-bss-set-2-left-reps').props.value).toBe('');
    expect(screen.getByTestId('exercise-card-we-bss-set-2-right-weight').props.value).toBe('');
    expect(screen.getByTestId('exercise-card-we-bss-set-2-right-reps').props.value).toBe('');
  });

  it('adds a unilateral exercise from the picker, creating both a left and a right blank row for its first set', async () => {
    mockFetchExercises.mockResolvedValue([
      {
        id: 'ex-row',
        name: 'Single-Arm Dumbbell Row',
        muscleGroup: 'back',
        movementType: 'unilateral',
        loggingStyle: 'single_side',
        isActive: true,
        createdBy: null,
      },
    ]);
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

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we-bss');

    fireEvent.press(screen.getByTestId('active-workout-add-exercise'));
    fireEvent.press(await screen.findByTestId('exercise-item-ex-row'));

    await waitFor(() => expect(mockAddExerciseToWorkout).toHaveBeenCalledWith('w1', 'ex-row', 2));
    expect(mockCreateSet).toHaveBeenCalledWith('we2', 1, 'left');
    expect(mockCreateSet).toHaveBeenCalledWith('we2', 1, 'right');
    const card = await screen.findByTestId('exercise-card-we2');
    expect(within(card).getByTestId('exercise-card-we2-set-1-left-weight')).toBeTruthy();
    expect(within(card).getByTestId('exercise-card-we2-set-1-right-weight')).toBeTruthy();
  });
});

describe('New sets start empty', () => {
  const lastBench = {
    performedAt: '2026-01-05T00:00:00Z',
    sets: [
      { id: 'prev-1', setIndex: 1, weightKg: 100, reps: 10, completedAt: '...', side: null },
      { id: 'prev-2', setIndex: 2, weightKg: 100, reps: 9, completedAt: '...', side: null },
      { id: 'prev-3', setIndex: 3, weightKg: 95, reps: 8, completedAt: '...', side: null },
    ],
  };

  function renderScreen() {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
  }

  beforeEach(() => {
    mockCreateSet.mockResolvedValue({
      id: 's3',
      setIndex: 3,
      side: null,
      weightKg: null,
      reps: null,
      completedAt: null,
    });
  });

  it('after 100 kg x 8, a new set is empty -- never a copy of the set before -- and saves nothing', async () => {
    renderScreen();
    await screen.findByTestId('exercise-card-we1');

    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), '100');
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '8');
    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's2',
        expect.objectContaining({ completedAt: expect.any(String) }),
      ),
    );

    fireEvent.press(screen.getByTestId('exercise-card-we1-add-set'));

    const weight = await screen.findByTestId('exercise-card-we1-set-s3-weight');
    expect(weight.props.value).toBe('');
    expect(weight.props.editable).toBe(true);
    expect(screen.getByTestId('exercise-card-we1-set-s3-reps').props.value).toBe('');
    expect(screen.queryByTestId('exercise-card-we1-set-s3-complete')).toBeNull();
    await pastTheSaveDelay();
    expect(mockUpdateSet).not.toHaveBeenCalledWith('s3', expect.anything());
  });

  it("leaves a planned day's sets empty, with last session shown above them", async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      exercises: [
        {
          ...baseWorkout.exercises[0],
          sets: [
            { id: 'pl1', setIndex: 1, side: null, weightKg: null, reps: null, completedAt: null },
            { id: 'pl2', setIndex: 2, side: null, weightKg: null, reps: null, completedAt: null },
          ],
        },
      ],
    });
    mockFetchPreviousPerformance.mockResolvedValue(lastBench);
    render(
      <ActiveWorkoutScreen
        navigation={navigation}
        route={{ params: { workoutId: 'w1', planned: true } } as never}
      />,
      { wrapper: TestProviders },
    );

    await screen.findByTestId('exercise-card-we1-previous-session');
    expect(screen.getByTestId('exercise-card-we1-set-pl1-weight').props.value).toBe('');
    expect(screen.getByTestId('exercise-card-we1-set-pl1-reps').props.value).toBe('');
    expect(screen.getByTestId('exercise-card-we1-set-pl2-weight').props.value).toBe('');
  });

  it('shows why part of a planned day is missing, when starting it said so', async () => {
    render(
      <ActiveWorkoutScreen
        navigation={navigation}
        route={
          {
            params: { workoutId: 'w1', planError: "Not all of this day's plan could be added." },
          } as never
        }
      />,
      { wrapper: TestProviders },
    );

    expect(await screen.findByTestId('active-workout-error')).toHaveTextContent(
      "Not all of this day's plan could be added.",
    );
  });

  it('never fills a new set from the same set number last session', async () => {
    mockFetchPreviousPerformance.mockResolvedValue(lastBench);
    renderScreen();
    await screen.findByTestId('exercise-card-we1-previous-session');

    fireEvent.press(screen.getByTestId('exercise-card-we1-add-set'));

    const weight = await screen.findByTestId('exercise-card-we1-set-s3-weight');
    expect(weight.props.value).toBe('');
    expect(screen.getByTestId('exercise-card-we1-set-s3-reps').props.value).toBe('');
  });

  it("starts a newly added exercise's first set empty, with its last session shown", async () => {
    mockFetchExercises.mockResolvedValue([
      { id: 'ex2', name: 'Barbell Back Squat', muscleGroup: 'quadriceps', isActive: true },
    ]);
    mockFetchPreviousPerformance.mockImplementation(async (_userId: string, exerciseId: string) =>
      exerciseId === 'ex2'
        ? {
            performedAt: '2026-01-04T00:00:00Z',
            sets: [
              { id: 'prev-x', setIndex: 1, weightKg: 60, reps: 8, completedAt: '...', side: null },
            ],
          }
        : null,
    );
    mockCreateSet.mockResolvedValue({
      id: 's3',
      setIndex: 1,
      side: null,
      weightKg: null,
      reps: null,
      completedAt: null,
    });
    renderScreen();
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-add-exercise'));
    fireEvent.press(await screen.findByTestId('exercise-item-ex2'));

    await screen.findByTestId('exercise-card-we2-previous-session');
    expect(screen.getByTestId('exercise-card-we2-set-s3-weight').props.value).toBe('');
    expect(screen.getByTestId('exercise-card-we2-set-s3-reps').props.value).toBe('');
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it("keeps what was typed into a new exercise's first set while last session was loading", async () => {
    mockFetchExercises.mockResolvedValue([
      { id: 'ex2', name: 'Barbell Back Squat', muscleGroup: 'quadriceps', isActive: true },
    ]);
    let finishLoading: (value: unknown) => void = () => {};
    mockFetchPreviousPerformance.mockImplementation((_userId: string, exerciseId: string) =>
      exerciseId === 'ex2'
        ? new Promise((resolve) => {
            finishLoading = resolve;
          })
        : Promise.resolve(null),
    );
    mockCreateSet.mockResolvedValue({
      id: 's3',
      setIndex: 1,
      side: null,
      weightKg: null,
      reps: null,
      completedAt: null,
    });
    renderScreen();
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-add-exercise'));
    fireEvent.press(await screen.findByTestId('exercise-item-ex2'));
    fireEvent.changeText(await screen.findByTestId('exercise-card-we2-set-s3-weight'), '70');
    await act(async () => {
      finishLoading({
        performedAt: '2026-01-04T00:00:00Z',
        sets: [
          { id: 'prev-x', setIndex: 1, weightKg: 60, reps: 8, completedAt: '...', side: null },
        ],
      });
    });

    await screen.findByTestId('exercise-card-we2-previous-session');
    expect(screen.getByTestId('exercise-card-we2-set-s3-weight').props.value).toBe('70');
    expect(screen.getByTestId('exercise-card-we2-set-s3-reps').props.value).toBe('');
  });
});

describe('Last Time You Did This', () => {
  // Explicitly removed from the live workout screen (was reintroducing
  // extra vertical content mid-workout) -- this guards it doesn't quietly
  // come back.
  it('does not render anywhere on the live workout screen', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    expect(screen.queryByTestId('active-workout-last-time')).toBeNull();
    expect(screen.queryByText('Last Time You Did This')).toBeNull();
    expect(screen.queryByText('Shown are your top sets from last time.')).toBeNull();
  });
});

describe('Cancel Workout', () => {
  it('asks for confirmation before cancelling', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
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
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('cancel-workout'));

    expect(mockCancelWorkout).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('soft-deletes the workout and returns to Feed on confirm -- never completing or advancing it', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Cancel Workout')?.onPress?.();
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
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
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('cancel-workout'));

    expect(await screen.findByTestId('active-workout-error')).toHaveTextContent('network error');
    expect(mockReset).not.toHaveBeenCalled();
  });
});

describe('Create Custom Exercise from Add Exercise', () => {
  it('opens the full New Exercise screen from inside the picker, and reopens the picker with the new exercise addable after saving', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-add-exercise'));
    fireEvent.press(await screen.findByTestId('exercise-picker-create-custom'));

    // The picker closes and the full New Exercise screen (with its own
    // Your Setup section, photo and all) replaces the active workout in its place.
    expect(screen.queryByTestId('exercise-search')).toBeNull();
    expect(await screen.findByText('New Exercise')).toBeTruthy();
    expect(screen.getByText('Your Setup (Optional)')).toBeTruthy();

    mockCreateExercise.mockResolvedValue({ id: 'ex-new' });
    mockFetchExercises.mockResolvedValue([
      {
        id: 'ex-new',
        name: 'Cable Preacher Curl',
        muscleGroup: 'biceps',
        isActive: true,
        createdBy: 'user-1',
      },
    ]);

    // The form's check for the very same setup already in the library finds none yet.
    mockFetchExercises.mockResolvedValueOnce([]);
    fireEvent.changeText(screen.getByTestId('exercise-form-name'), 'Cable Preacher Curl');
    fireEvent.press(screen.getByTestId('exercise-form-muscle-group'));
    fireEvent.press(screen.getByTestId('exercise-form-muscle-group-option-biceps'));
    fireEvent.press(screen.getByTestId('exercise-form-save'));

    // Back in the picker, immediately able to add the exercise just created.
    fireEvent.press(await screen.findByTestId('exercise-item-ex-new'));

    await waitFor(() => expect(mockAddExerciseToWorkout).toHaveBeenCalledWith('w1', 'ex-new', 2));
  });

  it('also opens the same full New Exercise screen from the standalone Create Custom button', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-create-custom'));

    expect(await screen.findByText('New Exercise')).toBeTruthy();
  });
});

describe('Last Workout', () => {
  it('shows no section for an exercise with no prior session', async () => {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
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

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    const section = await screen.findByTestId('exercise-card-we1-previous-session');
    expect(section).toHaveTextContent(/Last Time's Sets/);
    // In logged order, all 3 -- never capped or reduced to a single "top" set.
    expect(screen.getByTestId('exercise-card-we1-previous-set-1')).toHaveTextContent(
      /Set 1 of 3.*100 kg × 5.*Top Set/,
    );
    expect(screen.getByTestId('exercise-card-we1-previous-set-2')).toHaveTextContent(/97\.5 kg/);
    expect(screen.getByTestId('exercise-card-we1-previous-set-3')).toHaveTextContent(/95 kg/);
    // No Last Time tile beside All-Time Best: its top set is marked among the sets above.
    expect(screen.queryByTestId('exercise-card-we1-last')).toBeNull();
  });

  it('fetches and shows the previous session for a newly added exercise too, not just ones already in the workout', async () => {
    mockFetchExercises.mockResolvedValue([
      { id: 'ex2', name: 'Barbell Back Squat', muscleGroup: 'quadriceps', isActive: true },
    ]);
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

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(screen.getByTestId('active-workout-add-exercise'));
    fireEvent.press(await screen.findByTestId('exercise-item-ex2'));

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

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1-previous-session');

    fireEvent.press(screen.getByTestId('exercise-card-we1-view-history'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressExerciseDetail', {
      exerciseId: 'ex1',
      exerciseName: 'Barbell Bench Press',
    });
  });

  it("shows a timed exercise's last session without View History, which charts weights", async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      exercises: [
        {
          ...baseWorkout.exercises[0],
          exerciseName: 'Plank',
          measurementType: 'timed' as const,
          sets: [{ id: 's2', setIndex: 1, weightKg: null, reps: null, completedAt: null }],
        },
      ],
    });
    mockFetchPreviousPerformance.mockResolvedValue({
      performedAt: '2026-01-05T00:00:00Z',
      sets: [
        {
          id: 'prev-1',
          setIndex: 1,
          weightKg: null,
          reps: null,
          durationSeconds: 75,
          completedAt: '...',
          side: null,
        },
      ],
    });

    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    expect(await screen.findByTestId('exercise-card-we1-previous-session')).toHaveTextContent(
      /1:15/,
    );
    expect(screen.queryByTestId('exercise-card-we1-view-history')).toBeNull();

    // A new set starts empty, never from the time typed in the set before it.
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-time'), '1:20');
    fireEvent.press(screen.getByTestId('exercise-card-we1-add-set'));
    expect((await screen.findByTestId('exercise-card-we1-set-s3-time')).props.value).toBe('');
  });
});

describe('Progressive overload', () => {
  const profile = {
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    activeWorkoutSplitId: null,
    trainingComfort: 'knows_basics',
    repRangeMin: 8,
    repRangeMax: 12,
    progressionCuesEnabled: true,
  };
  const lastSession = (sets: { weightKg: number | null; reps: number }[]) => ({
    performedAt: '2026-01-05T00:00:00Z',
    sets: sets.map((set, i) => ({
      id: `prev-${i + 1}`,
      setIndex: i + 1,
      weightKg: set.weightKg,
      reps: set.reps,
      completedAt: '2026-01-05T00:10:00Z',
      side: null,
    })),
  });

  function renderScreen() {
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
  }

  beforeEach(() => {
    mockFetchMyProfile.mockResolvedValue(profile);
  });

  it('says to go up, on the set of last time that reached the top of the range', async () => {
    mockFetchPreviousPerformance.mockResolvedValue(
      lastSession([
        { weightKg: 100, reps: 12 },
        { weightKg: 100, reps: 10 },
      ]),
    );
    renderScreen();

    expect(await screen.findByTestId('exercise-card-we1-previous-set-1-flag')).toHaveTextContent(
      /Hit 12! Go up in weight today\./,
    );
    expect(screen.queryByTestId('exercise-card-we1-previous-set-2-flag')).toBeNull();
  });

  it('says nothing under or on last time short of the top of the range', async () => {
    mockFetchPreviousPerformance.mockResolvedValue(lastSession([{ weightKg: 100, reps: 7 }]));
    renderScreen();

    await screen.findByTestId('exercise-card-we1-previous-set-1');
    expect(screen.queryByTestId('exercise-card-we1-previous-set-1-flag')).toBeNull();
    expect(screen.queryByTestId('exercise-card-we1-cue')).toBeNull();
    expect(screen.queryByText(/Keep your top set weight/)).toBeNull();
  });

  it("follows the person's own range", async () => {
    mockFetchMyProfile.mockResolvedValue({
      ...profile,
      trainingComfort: 'follows_method',
      repRangeMin: 5,
      repRangeMax: 10,
    });
    mockFetchPreviousPerformance.mockResolvedValue(lastSession([{ weightKg: 140, reps: 10 }]));
    renderScreen();

    expect(await screen.findByTestId('exercise-card-we1-previous-set-1-flag')).toHaveTextContent(
      /Hit 10! Go up in weight today\./,
    );
  });

  it('says nothing when Progression Tips is off', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...profile, progressionCuesEnabled: false });
    mockFetchPreviousPerformance.mockResolvedValue(lastSession([{ weightKg: 100, reps: 12 }]));
    renderScreen();

    await screen.findByTestId('exercise-card-we1-previous-set-1');
    expect(screen.queryByTestId('exercise-card-we1-previous-set-1-flag')).toBeNull();
  });

  it('shows the all-time best within the range, with its date, from the PRs already kept', async () => {
    mockFetchAllRepPRs.mockResolvedValue([
      {
        exerciseId: 'ex1',
        exerciseName: 'Barbell Bench Press',
        muscleGroup: 'chest',
        reps: 9,
        bestWeightKg: 105,
        sourceSetId: 'pr-set',
        achievedAt: '2026-01-01T00:00:00Z',
      },
    ]);
    mockFetchPreviousPerformance.mockResolvedValue(lastSession([{ weightKg: 100, reps: 10 }]));
    renderScreen();

    const best = await screen.findByTestId('exercise-card-we1-best');
    expect(best).toHaveTextContent(/All-Time Best.*105 kg × 9/);
    expect(best).not.toHaveTextContent(/8–12/);
    // When it was set, as a date.
    expect(best).toHaveTextContent(/[A-Z][a-z]{2} \d{1,2}, \d{4}$/);
  });

  it("says so in the workout once today's top set reaches the top", async () => {
    renderScreen();
    await screen.findByTestId('exercise-card-we1');
    expect(screen.queryByTestId('exercise-card-we1-session-cue')).toBeNull();

    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), '110');
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '12');

    expect(await screen.findByTestId('exercise-card-we1-session-cue')).toHaveTextContent(
      /Top of your range\. Increase the weight next time\./,
    );
  });

  it('offers the weighted version on a bodyweight set that reached the top', async () => {
    mockFetchExercises.mockResolvedValue([
      {
        id: 'ex-weighted',
        name: 'Weighted Pull-Up',
        muscleGroup: 'back',
        movementType: 'bilateral',
        loggingStyle: null,
        measurementType: 'weight_reps',
        photoUrl: null,
        isActive: true,
        createdBy: null,
      },
    ]);
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      exercises: [
        {
          ...baseWorkout.exercises[0],
          exerciseName: 'Pull-Up',
          measurementType: 'bodyweight' as const,
          sets: [{ id: 's2', setIndex: 1, weightKg: null, reps: null, completedAt: null }],
        },
      ],
    });
    mockFetchPreviousPerformance.mockResolvedValue(lastSession([{ weightKg: null, reps: 12 }]));
    renderScreen();

    await waitFor(() =>
      expect(screen.getByTestId('exercise-card-we1-previous-set-1-flag')).toHaveTextContent(
        /Hit 12! Try Weighted Pull-Up today\./,
      ),
    );
  });

  it('says nothing about last time on a timed exercise, which has no range', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      exercises: [
        {
          ...baseWorkout.exercises[0],
          exerciseName: 'Plank',
          measurementType: 'timed' as const,
          sets: [{ id: 's2', setIndex: 1, weightKg: null, reps: null, completedAt: null }],
        },
      ],
    });
    mockFetchPreviousPerformance.mockResolvedValue({
      performedAt: '2026-01-05T00:00:00Z',
      sets: [
        {
          id: 'prev-1',
          setIndex: 1,
          weightKg: null,
          reps: null,
          durationSeconds: 75,
          completedAt: '2026-01-05T00:10:00Z',
          side: null,
        },
      ],
    });
    renderScreen();

    expect(await screen.findByTestId('exercise-card-we1-previous-set-1')).toHaveTextContent(/1:15/);
    expect(screen.queryByTestId('exercise-card-we1-previous-set-1-flag')).toBeNull();
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
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1');
  }

  it("shows each exercise as its own widget, under the workout's own", async () => {
    mockFetchWorkoutDetail.mockResolvedValue(twoExercises);
    await renderReady();

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(0);
    // The workout's widget (pinned, its cardio line in it), then one per exercise.
    expect(screen.UNSAFE_queryAllByType(Card).map((card) => card.props.testID)).toEqual([
      'active-workout-hero',
      'exercise-card-we1',
      'exercise-card-we2',
    ]);
  });

  it('shows the workout name and its muscles in the header', async () => {
    await renderReady();

    const header = within(screen.getByTestId('active-workout-header'));
    expect(header.getByText('Push Day')).toBeTruthy();
    expect(header.getByText('Chest')).toBeTruthy();
  });

  it('pins duration, sets and exercise count outside the scrolling list so they stay in view', async () => {
    await renderReady();

    const scroll = within(exerciseList());
    expect(scroll.queryByTestId('active-workout-summary')).toBeNull();
    expect(screen.getByTestId('workout-summary-duration')).toBeTruthy();
    expect(screen.getByTestId('workout-summary-total-sets')).toBeTruthy();
    expect(screen.getByTestId('workout-summary-total-exercises')).toBeTruthy();
  });

  it('offers no way to turn a workout already going into a group', async () => {
    await renderReady();

    expect(screen.queryByTestId('start-group-from-workout')).toBeNull();
    expect(screen.queryByText(/group/i)).toBeNull();
  });

  it('has exactly one filled button -- Finish Workout -- pinned outside the scrolling list', async () => {
    await renderReady();

    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    const scroll = within(exerciseList());
    expect(scroll.queryByTestId('complete-workout')).toBeNull();
    expect(screen.getByTestId('complete-workout')).toHaveTextContent('Finish Workout');
  });

  it('keeps Cancel Workout quiet: destructive text at the end of the list, away from Finish', async () => {
    await renderReady();

    const cancel = screen.getByTestId('cancel-workout');
    expect(within(exerciseList()).getByTestId('cancel-workout')).toBe(cancel);
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

  it('makes each set input a large, named, mono readout, with no check to aim for', async () => {
    await renderReady();

    const weight = screen.getByTestId('exercise-card-we1-set-s2-weight');
    const flat = StyleSheet.flatten(weight.props.style);
    expect(flat.height).toBeGreaterThanOrEqual(48);
    expect(flat.fontFamily).toBe(fonts.mono);
    expect(weight.props.accessibilityLabel).toBe('Set 2 weight');
    expect(screen.getByTestId('exercise-card-we1-set-s2-reps').props.accessibilityLabel).toBe(
      'Set 2 reps',
    );
    expect(screen.queryByTestId('exercise-card-we1-set-s2-complete')).toBeNull();
  });

  it('avoids the on-screen keyboard so the set being typed stays visible', async () => {
    await renderReady();

    expect(screen.UNSAFE_getAllByType(KeyboardAvoidingView).length).toBeGreaterThan(0);
  });

  it("shows last time's sets one at a time, each as its own slide", async () => {
    mockFetchPreviousPerformance.mockResolvedValue({
      performedAt: '2026-01-05T00:00:00Z',
      sets: [
        { id: 'p1', setIndex: 1, weightKg: 100, reps: 5, completedAt: '...', side: null },
        { id: 'p2', setIndex: 2, weightKg: 97.5, reps: 5, completedAt: '...', side: null },
      ],
    });
    await renderReady();

    await screen.findByTestId('exercise-card-we1-previous-session');
    const lastSet1 = within(screen.getByTestId('exercise-card-we1-previous-set-1'));
    expect(lastSet1.getByText('100 kg × 5')).toBeTruthy();
    const lastSet2 = within(screen.getByTestId('exercise-card-we1-previous-set-2'));
    expect(lastSet2.getByText('97.5 kg × 5')).toBeTruthy();
    // The carousel: one horizontal, paged strip of slides, in the exercise's card.
    const strips = within(screen.getByTestId('exercise-card-we1'))
      .UNSAFE_queryAllByType(ScrollView)
      .filter((node) => node.props.horizontal);
    expect(strips).toHaveLength(1);
    expect(strips[0].props.pagingEnabled).toBe(true);
  });
});

describe('ActiveWorkoutScreen renders no bare text outside <Text>', () => {
  it('has no string directly inside a View, with a previous session shown', async () => {
    mockFetchPreviousPerformance.mockResolvedValue({
      performedAt: '2026-01-05T00:00:00Z',
      sets: [{ id: 'p1', setIndex: 1, weightKg: 100, reps: 5, completedAt: '...', side: 'left' }],
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
    await screen.findByTestId('exercise-card-we1-previous-session');

    expectNoBareText();
  });
});

describe("ActiveWorkoutScreen -- an exercise's own rep range", () => {
  it('shows the range each exercise is judged against, and saves one of its own', async () => {
    (saveExerciseSetting as jest.Mock).mockResolvedValue({
      exerciseId: 'ex1',
      exerciseName: 'Bench Press',
      range: { min: 10, max: 14 },
      incrementKg: null,
    });
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    expect(await screen.findByTestId('active-workout-rep-range')).toHaveTextContent(
      /Your rep range 8–12/,
    );
    expect(screen.queryByTestId('exercise-card-we1-own-range')).toBeNull();

    fireEvent.press(screen.getByTestId('exercise-card-we1-menu'));
    fireEvent.press(screen.getByTestId('exercise-card-we1-range'));
    fireEvent.press(screen.getByTestId('exercise-progression-source-own'));
    // The wheels start on the person's 8-12, and show the values from there on.
    fireEvent.press(screen.getByTestId('exercise-range-min-item-10'));
    fireEvent.press(screen.getByTestId('exercise-range-max-item-14'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('exercise-progression-save'));
    });

    expect(saveExerciseSetting).toHaveBeenCalledWith('user-1', 'ex1', {
      range: { min: 10, max: 14 },
      incrementKg: null,
    });
    await waitFor(() =>
      expect(screen.getByTestId('exercise-card-we1-own-range')).toHaveTextContent(
        'Own range 10–14',
      ),
    );
    expect(screen.getByTestId('active-workout-rep-range-own')).toHaveTextContent(
      '1 exercise here has its own',
    );
  });

  it('reads the ranges already set when the workout opens', async () => {
    (fetchExerciseSettings as jest.Mock).mockResolvedValue(
      new Map([
        [
          'ex1',
          {
            exerciseId: 'ex1',
            exerciseName: 'Bench Press',
            range: { min: 5, max: 5 },
            incrementKg: 1,
          },
        ],
      ]),
    );
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    await waitFor(() =>
      expect(screen.getByTestId('exercise-card-we1-own-range')).toHaveTextContent('Own range 5'),
    );
    expect(fetchExerciseSettings).toHaveBeenCalledWith('user-1');
  });
});

describe("ActiveWorkoutScreen -- the person's rep range, at the top", () => {
  it('shows it once, in the pinned workout widget, and changes it there', async () => {
    (updateMyProfile as jest.Mock).mockImplementation(async (_token: string, updates: object) => ({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'kg',
      workoutAccentColor: null,
      nutritionAccentColor: null,
      activeWorkoutSplitId: null,
      ...updates,
    }));
    render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });

    const row = await screen.findByTestId('active-workout-rep-range');
    expect(within(exerciseList()).queryByTestId('active-workout-rep-range')).toBeNull();
    expect(screen.getByTestId('active-workout-rep-range-value')).toHaveTextContent('8–12');
    expect(row).not.toHaveTextContent(/have their own|has its own/);

    fireEvent.press(screen.getByTestId('active-workout-rep-range-edit'));
    // The wheels start on 8-12 and show the values from there on.
    fireEvent.press(screen.getByTestId('rep-range-min-item-10'));
    fireEvent.press(screen.getByTestId('rep-range-max-item-14'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('rep-range-save'));
    });

    expect(updateMyProfile).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({ repRangeMin: 10, repRangeMax: 14 }),
    );
    await waitFor(() =>
      expect(screen.getByTestId('active-workout-rep-range-value')).toHaveTextContent('10–14'),
    );
  });
});

describe('ActiveWorkoutScreen -- timing a timed set', () => {
  let now = 1_000_000;

  beforeEach(async () => {
    await clearSetTimers('w1');
    now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      exercises: [
        {
          ...baseWorkout.exercises[0],
          exerciseName: 'Plank',
          muscleGroup: 'abs' as const,
          measurementType: 'timed' as const,
          sets: [{ id: 's2', setIndex: 1, weightKg: null, reps: null, completedAt: null }],
        },
      ],
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await clearSetTimers('w1');
  });

  function renderLive() {
    return render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
  }

  const timer = () => screen.getByTestId('exercise-card-we1-set-s2-timer');
  const time = () => screen.getByTestId('exercise-card-we1-set-s2-time');

  it('starts, pauses with the time in the field, and resumes', async () => {
    renderLive();
    await screen.findByTestId('exercise-card-we1');

    expect(timer()).toHaveTextContent(/Start/);

    fireEvent.press(timer());
    expect(timer()).toHaveTextContent(/Pause/);
    // Running, the field isn't typed into.
    expect(time().props.editable).toBe(false);

    now += 42_000;
    fireEvent.press(timer());
    expect(time().props.value).toBe('0:42');
    expect(timer()).toHaveTextContent(/Resume/);

    fireEvent.press(timer());
    now += 18_000;
    fireEvent.press(timer());
    expect(time().props.value).toBe('1:00');
  });

  it('saves the time when the timer is paused', async () => {
    renderLive();
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(timer());
    now += 30_000;
    fireEvent.press(timer());

    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's2',
        expect.objectContaining({ durationSeconds: 30, completedAt: expect.any(String) }),
      ),
    );
  });

  it("stops a timer still going at Finish, saving its time as the set's", async () => {
    renderLive();
    await screen.findByTestId('exercise-card-we1');

    fireEvent.press(timer());
    now += 75_400;
    savedWithAFinishedSet();
    const alert = confirmFinish();
    fireEvent.press(screen.getByTestId('complete-workout'));

    await waitFor(() =>
      expect(mockUpdateSet).toHaveBeenCalledWith(
        's2',
        expect.objectContaining({ durationSeconds: 75, completedAt: expect.any(String) }),
      ),
    );
    await waitFor(() => expect(mockCompleteWorkout).toHaveBeenCalledWith('w1'));
    alert.mockRestore();
  });

  it('keeps time while the page is away: a remount finds it still running', async () => {
    const { unmount } = renderLive();
    await screen.findByTestId('exercise-card-we1');
    fireEvent.press(timer());
    unmount();

    now += 30_000;
    renderLive();
    await screen.findByTestId('exercise-card-we1');

    expect(timer()).toHaveTextContent(/Pause/);
    fireEvent.press(timer());
    expect(time().props.value).toBe('0:30');
  });

  it('drops the timer when the time is typed instead', async () => {
    renderLive();
    await screen.findByTestId('exercise-card-we1');
    fireEvent.press(timer());
    now += 10_000;
    fireEvent.press(timer());

    fireEvent.changeText(time(), '1:30');

    expect(timer()).toHaveTextContent(/Start/);
    expect(time().props.value).toBe('1:30');
  });

  it('forgets a running timer when the workout is cancelled', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((b) => b.text === 'Cancel Workout')?.onPress?.();
    });
    renderLive();
    await screen.findByTestId('exercise-card-we1');
    fireEvent.press(timer());

    await act(async () => {
      fireEvent.press(screen.getByTestId('cancel-workout'));
    });

    expect(stopSetTimer('s2')).toBeNull();
  });
});

describe('ActiveWorkoutScreen -- a guided workout (a planned day)', () => {
  const plan = [
    {
      id: 'p1',
      exerciseId: 'ex1',
      exerciseName: 'Barbell Bench Press',
      muscleGroup: 'chest',
      movementType: 'bilateral',
      measurementType: 'weight_reps',
      position: 1,
      targetSets: 3,
    },
    {
      id: 'p2',
      exerciseId: 'ex2',
      exerciseName: 'Squat',
      muscleGroup: 'quads',
      movementType: 'bilateral',
      measurementType: 'weight_reps',
      position: 2,
      targetSets: 3,
    },
    {
      id: 'p3',
      exerciseId: 'ex3',
      exerciseName: 'Lat Pulldown',
      muscleGroup: 'back',
      movementType: 'bilateral',
      measurementType: 'weight_reps',
      position: 3,
      targetSets: 2,
    },
  ];

  beforeEach(() => {
    mockFetchWorkoutDetail.mockResolvedValue({ ...baseWorkout, workoutSplitDayId: 'day1' });
    (isGuided as jest.Mock).mockResolvedValue(true);
    (fetchDayPlan as jest.Mock).mockResolvedValue(plan);
  });

  afterEach(() => {
    (isGuided as jest.Mock).mockResolvedValue(false);
    (fetchDayPlan as jest.Mock).mockResolvedValue([]);
  });

  function renderGuided() {
    return render(<ActiveWorkoutScreen navigation={navigation} route={route} />, {
      wrapper: TestProviders,
    });
  }

  it('shows only the exercise being done, with the next one from the plan in Up Next', async () => {
    renderGuided();

    expect(await screen.findByTestId('active-workout-up-next-name')).toHaveTextContent('Squat');
    expect(screen.getByTestId('exercise-card-we1')).toBeTruthy();
    expect(fetchDayPlan).toHaveBeenCalledWith('day1');
    // The rest of the plan is a tap away, not laid out.
    expect(screen.queryByTestId('active-workout-up-next-other-p3')).toBeNull();
    fireEvent.press(screen.getByTestId('active-workout-up-next-choose'));
    expect(screen.getByTestId('active-workout-up-next-other-p3')).toHaveTextContent(/Lat Pulldown/);
  });

  it('starts the next planned exercise in one tap; the one done folds away above it', async () => {
    mockCreateSet.mockResolvedValue({
      id: 's-squat-1',
      setIndex: 1,
      weightKg: null,
      reps: null,
      completedAt: null,
    });
    renderGuided();

    fireEvent.press(await screen.findByTestId('active-workout-up-next-start'));

    await waitFor(() => expect(mockAddExerciseToWorkout).toHaveBeenCalledWith('w1', 'ex2', 2));
    expect(await screen.findByTestId('exercise-card-we2')).toBeTruthy();
    expect(screen.queryByTestId('exercise-card-we1')).toBeNull();
    // Its untouched set is set aside; the set done stays.
    expect(mockDeleteSet).toHaveBeenCalledWith('s2');
    expect(screen.getByTestId('active-workout-done-we1')).toHaveTextContent(/1 set done/);
    expect(screen.getByTestId('active-workout-up-next-name')).toHaveTextContent('Lat Pulldown');

    // Tapped, the one done opens again.
    fireEvent.press(screen.getByTestId('active-workout-done-we1'));
    expect(await screen.findByTestId('exercise-card-we1')).toBeTruthy();
  });

  it("adds the next set by itself once a set is filled in, up to the plan's sets", async () => {
    renderGuided();
    await screen.findByTestId('exercise-card-we1');

    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-weight'), '100');
    fireEvent.changeText(screen.getByTestId('exercise-card-we1-set-s2-reps'), '8');

    await waitFor(() => expect(mockCreateSet).toHaveBeenCalledWith('we1', 3));
    expect(await screen.findByTestId('exercise-card-we1-set-s3-weight')).toBeTruthy();
    expect(mockCreateSet).toHaveBeenCalledTimes(1);
  });

  it("has the muscle tabs too: a muscle's tab once it's started, showing only its exercises", async () => {
    mockCreateSet.mockResolvedValue({
      id: 's-squat-1',
      setIndex: 1,
      weightKg: null,
      reps: null,
      completedAt: null,
    });
    renderGuided();

    // The plan's first exercise is already in: All and Chest -- not Quads or Back, still ahead.
    const tabs = await screen.findByTestId('active-workout-muscle-tabs');
    expect(within(tabs).getByTestId('active-workout-muscle-tabs-chest')).toBeTruthy();
    expect(within(tabs).queryByTestId('active-workout-muscle-tabs-quads')).toBeNull();

    fireEvent.press(screen.getByTestId('active-workout-up-next-start'));
    expect(await screen.findByTestId('active-workout-muscle-tabs-quads')).toBeTruthy();
    expect(await screen.findByTestId('exercise-card-we2')).toBeTruthy();

    // Chest: just the bench press, folded, a tap from open -- not the squat being done, and no
    // Up Next, since what's left of the plan isn't chest.
    fireEvent.press(screen.getByTestId('active-workout-muscle-tabs-chest'));
    expect(screen.queryByTestId('exercise-card-we2')).toBeNull();
    expect(screen.getByTestId('active-workout-done-we1')).toBeTruthy();
    expect(screen.queryByTestId('active-workout-up-next')).toBeNull();
    expect(screen.queryByTestId('active-workout-plan-done')).toBeNull();
    fireEvent.press(screen.getByTestId('active-workout-done-we1'));
    expect(await screen.findByTestId('exercise-card-we1')).toBeTruthy();

    // Moving on set the squat aside untouched, so it's back in Up Next and its tab has gone.
    fireEvent.press(screen.getByTestId('active-workout-muscle-tabs-all'));
    expect(screen.getByTestId('active-workout-up-next-name')).toHaveTextContent('Squat');
    expect(screen.queryByTestId('active-workout-muscle-tabs-quads')).toBeNull();
  });

  it('is the usual live workout for a planned day with no plan to follow', async () => {
    (fetchDayPlan as jest.Mock).mockResolvedValue([]);
    renderGuided();

    await screen.findByTestId('exercise-card-we1');
    expect(screen.queryByTestId('active-workout-up-next')).toBeNull();
  });
});
