import type { PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { BackgroundThemeProvider } from '../design/BackgroundThemeContext';
import { toLocalDateKey } from '../design/calendarGrid';
import { fetchAllExercises } from '../exercises/exerciseQueries';
import { getMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { AllTimeStatsProvider } from '../progress/AllTimeStatsProvider';
import { fetchAllCompletedWorkouts } from '../progress/progressStatsQueries';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { fetchAllOneRepMaxes, fetchAllRepPRs } from '../workouts/prSummaryQueries';
import {
  addExerciseToWorkout,
  createSet,
  deleteSet,
  fetchWorkoutDetail,
  removeExerciseFromWorkout,
  updateSet,
  updateWorkout,
  fetchNextExerciseOrderIndex,
} from '../workouts/workoutQueries';
import { EditWorkoutScreen } from './EditWorkoutScreen';

// Derived from the real clock (same convention as LogPastWorkoutScreen.test.tsx
// and WorkoutHistoryScreen.test.tsx) so this never rots into a flaky
// date-dependent test as time passes. A week ago rather than "day 5 of this
// month" -- the latter can land AFTER today early in a month and trip the
// screen's own "pick a date that's already happened" guard.
const today = new Date();
const CURRENT_YEAR = today.getFullYear();
const CURRENT_MONTH = today.getMonth() + 1;
const aWeekAgo = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7, 12, 0, 0);
const FIXTURE_PERFORMED_AT = aWeekAgo.toISOString();

function TestProviders({ children }: PropsWithChildren) {
  return (
    <ProfileProvider>
      <AllTimeStatsProvider>{children}</AllTimeStatsProvider>
    </ProfileProvider>
  );
}

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
  fetchAllExercises: jest.fn(),
  invalidateExerciseCache: jest.fn(),
  fetchExerciseSourceCounts: jest.fn().mockResolvedValue({ all: 0, builtin: 0, mine: 0 }),
}));

jest.mock('../progress/progressStatsQueries', () => ({
  fetchAllCompletedWorkouts: jest.fn(),
}));

jest.mock('../workouts/allExerciseHistoryQueries', () => ({
  fetchAllExerciseHistory: jest.fn(),
}));

jest.mock('../workouts/prSummaryQueries', () => ({
  fetchAllRepPRs: jest.fn(),
  fetchAllOneRepMaxes: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutDetail: jest.fn(),
  fetchNextExerciseOrderIndex: jest.fn(),
  updateWorkout: jest.fn(),
  addExerciseToWorkout: jest.fn(),
  removeExerciseFromWorkout: jest.fn(),
  createSet: jest.fn(),
  updateSet: jest.fn(),
  deleteSet: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchExercises = fetchAllExercises as jest.Mock;
const mockFetchAllCompletedWorkouts = fetchAllCompletedWorkouts as jest.Mock;
const mockFetchAllExerciseHistory = fetchAllExerciseHistory as jest.Mock;
const mockFetchAllRepPRs = fetchAllRepPRs as jest.Mock;
const mockFetchAllOneRepMaxes = fetchAllOneRepMaxes as jest.Mock;
const mockFetchWorkoutDetail = fetchWorkoutDetail as jest.Mock;
const mockUpdateWorkout = updateWorkout as jest.Mock;
const mockAddExerciseToWorkout = addExerciseToWorkout as jest.Mock;
const mockFetchNextExerciseOrderIndex = fetchNextExerciseOrderIndex as jest.Mock;
const mockRemoveExerciseFromWorkout = removeExerciseFromWorkout as jest.Mock;
const mockCreateSet = createSet as jest.Mock;
const mockUpdateSet = updateSet as jest.Mock;
const mockDeleteSet = deleteSet as jest.Mock;

const mockGoBack = jest.fn();
const mockReplace = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, replace: mockReplace };
const route = { params: { workoutId: 'w1' } } as never;

function renderScreen() {
  return render(
    <BackgroundThemeProvider>
      <EditWorkoutScreen navigation={navigation} route={route} />
    </BackgroundThemeProvider>,
    { wrapper: TestProviders },
  );
}

const baseWorkout = {
  id: 'w1',
  name: 'Leg Day',
  performedAt: FIXTURE_PERFORMED_AT,
  completedAt: FIXTURE_PERFORMED_AT,
  workoutSplitDayId: null,
  exercises: [
    {
      id: 'we1',
      exerciseId: 'ex-squat',
      exerciseName: 'Barbell Back Squat',
      muscleGroup: 'quadriceps' as const,
      movementType: 'bilateral' as const,
      loggingStyle: null,
      orderIndex: 1,
      sets: [{ id: 's1', setIndex: 1, weightKg: 100, reps: 5, completedAt: FIXTURE_PERFORMED_AT }],
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
  mockFetchExercises.mockReset().mockResolvedValue([]);
  mockFetchAllCompletedWorkouts.mockReset().mockResolvedValue([]);
  mockFetchAllExerciseHistory.mockReset().mockResolvedValue([]);
  mockFetchAllRepPRs.mockReset().mockResolvedValue([]);
  mockFetchAllOneRepMaxes.mockReset().mockResolvedValue([]);
  mockFetchWorkoutDetail.mockReset().mockResolvedValue(baseWorkout);
  mockUpdateWorkout.mockReset().mockResolvedValue(undefined);
  mockAddExerciseToWorkout.mockReset().mockResolvedValue('we2');
  mockFetchNextExerciseOrderIndex.mockReset().mockResolvedValue(2);
  mockRemoveExerciseFromWorkout.mockReset().mockResolvedValue(undefined);
  mockCreateSet
    .mockReset()
    .mockImplementation(async (_workoutExerciseId: string, setIndex: number, side?: string) => ({
      id: `set-${setIndex}-${side ?? 'none'}`,
      setIndex,
      side: side ?? null,
      weightKg: null,
      reps: null,
      completedAt: null,
    }));
  mockUpdateSet
    .mockReset()
    .mockImplementation(async (setId: string, updates: Record<string, unknown>) => ({
      id: setId,
      setIndex: 1,
      side: null,
      ...updates,
    }));
  mockDeleteSet.mockReset().mockResolvedValue(undefined);
  mockGoBack.mockClear();
  mockReplace.mockClear();
});

const EX = 'edit-workout-exercise-local-1';

describe('EditWorkoutScreen -- loading existing data', () => {
  it('seeds the name, date and existing sets from the real workout', async () => {
    renderScreen();

    expect(await screen.findByTestId('edit-workout-name')).toHaveProp('value', 'Leg Day');
    const block = await screen.findByTestId(EX);
    expect(within(block).getByText('Barbell Back Squat')).toBeTruthy();
    expect(screen.getByTestId(`${EX}-set-1-weight`)).toHaveProp('value', '100');
    expect(screen.getByTestId(`${EX}-set-1-reps`)).toHaveProp('value', '5');
  });

  it('shows a load error instead of the form when the fetch fails', async () => {
    mockFetchWorkoutDetail.mockReset().mockRejectedValue(new Error('network down'));
    renderScreen();

    expect(await screen.findByTestId('edit-workout-load-error')).toHaveTextContent('network down');
    expect(screen.queryByTestId('edit-workout-name')).toBeNull();
  });
});

describe('EditWorkoutScreen -- saving changes', () => {
  it('blocks saving with an empty name', async () => {
    renderScreen();
    await screen.findByTestId(EX);
    fireEvent.changeText(screen.getByTestId('edit-workout-name'), '');

    fireEvent.press(screen.getByTestId('edit-workout-save'));

    expect(await screen.findByTestId('edit-workout-error')).toHaveTextContent(
      'Enter a name for this workout',
    );
    expect(mockUpdateWorkout).not.toHaveBeenCalled();
  });

  it('rejects a future date instead of saving', async () => {
    // The calendar opens on the loaded workout's own month (aWeekAgo's month,
    // which can be last month early in a new month) -- press "next month"
    // however many times it takes to land one month past the REAL current
    // month, which is always in the future relative to the real clock.
    const monthsFromFixtureToOneLate =
      (CURRENT_YEAR - aWeekAgo.getFullYear()) * 12 +
      (CURRENT_MONTH - (aWeekAgo.getMonth() + 1)) +
      1;
    const futureDate = new Date(CURRENT_YEAR, CURRENT_MONTH, 15);
    renderScreen();
    await screen.findByTestId(EX);

    fireEvent.press(screen.getByTestId('edit-workout-date'));
    for (let i = 0; i < monthsFromFixtureToOneLate; i++) {
      fireEvent.press(await screen.findByTestId('calendar-next-month'));
    }
    fireEvent.press(await screen.findByTestId(`calendar-day-${toLocalDateKey(futureDate)}`));

    fireEvent.press(screen.getByTestId('edit-workout-save'));

    expect(await screen.findByTestId('edit-workout-error')).toHaveTextContent(
      "Pick a date that's already happened",
    );
    expect(mockUpdateWorkout).not.toHaveBeenCalled();
  });

  it('does not touch the workout row at all when nothing changed', async () => {
    renderScreen();
    await screen.findByTestId(EX);

    fireEvent.press(screen.getByTestId('edit-workout-save'));

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w1' }),
    );
    expect(mockUpdateWorkout).not.toHaveBeenCalled();
    expect(mockUpdateSet).not.toHaveBeenCalled();
  });

  it('renames the workout and saves a changed existing set by its real id', async () => {
    renderScreen();
    await screen.findByTestId(EX);

    fireEvent.changeText(screen.getByTestId('edit-workout-name'), 'Leg Day (Heavy)');
    fireEvent.changeText(screen.getByTestId(`${EX}-set-1-weight`), '105');

    fireEvent.press(screen.getByTestId('edit-workout-save'));

    await waitFor(() =>
      expect(mockUpdateWorkout).toHaveBeenCalledWith('w1', {
        name: 'Leg Day (Heavy)',
        performedAt: baseWorkout.performedAt,
        // No duration was ever recorded, so completedAt stays equal to performedAt.
        completedAt: baseWorkout.performedAt,
      }),
    );
    expect(mockUpdateSet).toHaveBeenCalledWith('s1', { weightKg: 105, reps: 5 });
    expect(mockCreateSet).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w1' }),
    );
  });

  it('seeds the duration from the workout, and saves an edited duration as completedAt = performedAt + duration', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      completedAt: new Date(new Date(FIXTURE_PERFORMED_AT).getTime() + 60 * 60000).toISOString(),
    });
    renderScreen();
    await screen.findByTestId(EX);

    expect(screen.getByTestId('edit-workout-duration-hours').props.value).toBe('1');
    expect(screen.getByTestId('edit-workout-duration-minutes').props.value).toBe('0');

    fireEvent.changeText(screen.getByTestId('edit-workout-duration-minutes'), '45');
    fireEvent.press(screen.getByTestId('edit-workout-save'));

    await waitFor(() =>
      expect(mockUpdateWorkout).toHaveBeenCalledWith('w1', {
        name: 'Leg Day',
        performedAt: baseWorkout.performedAt,
        completedAt: new Date(new Date(FIXTURE_PERFORMED_AT).getTime() + 105 * 60000).toISOString(),
      }),
    );
  });

  it('keeps an existing duration when only the date moves, rather than leaving completedAt behind', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      completedAt: new Date(new Date(FIXTURE_PERFORMED_AT).getTime() + 60 * 60000).toISOString(),
    });
    renderScreen();
    await screen.findByTestId(EX);

    // The 1st of the workout's own displayed month is always in the past and always
    // visible, so this moves the date without navigating the calendar -- unless the
    // workout itself is already dated the 1st, in which case the 2nd is used instead,
    // so the picked day always actually differs from the original.
    const targetDay = aWeekAgo.getDate() === 1 ? 2 : 1;
    const firstOfMonth = new Date(aWeekAgo.getFullYear(), aWeekAgo.getMonth(), targetDay);
    fireEvent.press(screen.getByTestId('edit-workout-date'));
    fireEvent.press(await screen.findByTestId(`calendar-day-${toLocalDateKey(firstOfMonth)}`));
    fireEvent.press(screen.getByTestId('edit-workout-save'));

    await waitFor(() => expect(mockUpdateWorkout).toHaveBeenCalled());
    const [, args] = mockUpdateWorkout.mock.calls[0];
    expect(args.completedAt).toBe(
      new Date(new Date(args.performedAt).getTime() + 60 * 60000).toISOString(),
    );
  });

  it('adds a new set to an existing exercise as a real created set', async () => {
    renderScreen();
    await screen.findByTestId(EX);

    fireEvent.press(screen.getByTestId(`${EX}-add-set`));
    await screen.findByTestId(`${EX}-set-2-weight`);
    fireEvent.changeText(screen.getByTestId(`${EX}-set-2-weight`), '110');
    fireEvent.changeText(screen.getByTestId(`${EX}-set-2-reps`), '3');

    fireEvent.press(screen.getByTestId('edit-workout-save'));

    await waitFor(() => expect(mockCreateSet).toHaveBeenCalledWith('we1', 2, undefined));
    expect(mockUpdateSet).toHaveBeenCalledWith('set-2-none', {
      weightKg: 110,
      reps: 3,
      completedAt: expect.any(String),
    });
    // The pre-existing set was never touched.
    expect(mockUpdateSet).not.toHaveBeenCalledWith('s1', expect.anything());
  });

  it('soft-deletes a removed existing set', async () => {
    renderScreen();
    await screen.findByTestId(EX);

    fireEvent.press(screen.getByTestId(`${EX}-set-1-remove`));

    fireEvent.press(screen.getByTestId('edit-workout-save'));

    // Removing the exercise's only set drops the exercise entirely (same
    // "no empty exercises" rule LogPastWorkoutScreen applies), so this
    // removes the workout_exercise rather than deleting the set directly.
    await waitFor(() => expect(mockRemoveExerciseFromWorkout).toHaveBeenCalledWith('we1'));
    expect(mockDeleteSet).not.toHaveBeenCalled();
  });

  it('soft-deletes one set but keeps the exercise when another set remains', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...baseWorkout,
      exercises: [
        {
          ...baseWorkout.exercises[0],
          sets: [
            ...baseWorkout.exercises[0].sets,
            {
              id: 's2',
              setIndex: 2,
              weightKg: 100,
              reps: 5,
              completedAt: FIXTURE_PERFORMED_AT,
            },
          ],
        },
      ],
    });
    renderScreen();
    await screen.findByTestId(`${EX}-set-2-weight`);

    fireEvent.press(screen.getByTestId(`${EX}-set-2-remove`));
    fireEvent.press(screen.getByTestId('edit-workout-save'));

    await waitFor(() => expect(mockDeleteSet).toHaveBeenCalledWith('s2'));
    expect(mockRemoveExerciseFromWorkout).not.toHaveBeenCalled();
  });

  it('removing an exercise block removes the whole workout_exercise', async () => {
    renderScreen();
    await screen.findByTestId(EX);

    fireEvent.press(screen.getByTestId(`${EX}-remove`));
    fireEvent.press(screen.getByTestId('edit-workout-save'));

    await waitFor(() => expect(mockRemoveExerciseFromWorkout).toHaveBeenCalledWith('we1'));
  });

  it('adds a brand new exercise as a real workout_exercise with its sets', async () => {
    mockFetchExercises.mockResolvedValue([
      { id: 'ex-bench', name: 'Bench Press', muscleGroup: 'chest' },
    ]);
    renderScreen();
    await screen.findByTestId(EX);

    fireEvent.press(screen.getByTestId('edit-workout-add-exercise'));
    fireEvent.press(await screen.findByTestId('exercise-item-ex-bench'));
    // local-1 (the loaded exercise) and local-2 (its one loaded set) are
    // already consumed by the initial seed, so the newly added exercise is local-3.
    const newBlock = await screen.findByTestId('edit-workout-exercise-local-3');
    fireEvent.changeText(within(newBlock).getByTestId(/-set-1-weight$/), '60');
    fireEvent.changeText(within(newBlock).getByTestId(/-set-1-reps$/), '10');

    fireEvent.press(screen.getByTestId('edit-workout-save'));

    await waitFor(() => expect(mockAddExerciseToWorkout).toHaveBeenCalledWith('w1', 'ex-bench', 2));
  });
});
