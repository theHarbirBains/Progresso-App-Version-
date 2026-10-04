import type { PropsWithChildren } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { BackgroundThemeProvider } from '../design/BackgroundThemeContext';
import { toLocalDateKey } from '../design/calendarGrid';
import { fetchExercises } from '../exercises/exerciseQueries';
import { getMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { AllTimeStatsProvider } from '../progress/AllTimeStatsProvider';
import { fetchAllCompletedWorkouts } from '../progress/progressStatsQueries';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { fetchAllOneRepMaxes, fetchAllRepPRs } from '../workouts/prSummaryQueries';
import {
  addExerciseToWorkout,
  createLoggedWorkout,
  createSet,
  updateSet,
} from '../workouts/workoutQueries';
import { LogPastWorkoutScreen } from './LogPastWorkoutScreen';

// Same fixture-date convention as WorkoutHistoryScreen.test.tsx: derived from
// the real clock so this never rots into a flaky date-dependent test, but
// always comfortably inside the currently-displayed month.
const today = new Date();
const CURRENT_YEAR = today.getFullYear();
const CURRENT_MONTH = today.getMonth() + 1;
const fixtureDate = new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 5);
const FIXTURE_DATE_KEY = toLocalDateKey(fixtureDate);

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
  fetchExercises: jest.fn(),
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
  createLoggedWorkout: jest.fn(),
  addExerciseToWorkout: jest.fn(),
  createSet: jest.fn(),
  updateSet: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchExercises = fetchExercises as jest.Mock;
const mockFetchAllCompletedWorkouts = fetchAllCompletedWorkouts as jest.Mock;
const mockFetchAllExerciseHistory = fetchAllExerciseHistory as jest.Mock;
const mockFetchAllRepPRs = fetchAllRepPRs as jest.Mock;
const mockFetchAllOneRepMaxes = fetchAllOneRepMaxes as jest.Mock;
const mockCreateLoggedWorkout = createLoggedWorkout as jest.Mock;
const mockAddExerciseToWorkout = addExerciseToWorkout as jest.Mock;
const mockCreateSet = createSet as jest.Mock;
const mockUpdateSet = updateSet as jest.Mock;

const mockGoBack = jest.fn();
const mockReplace = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, replace: mockReplace };
const route = {} as never;

function renderScreen() {
  return render(
    <BackgroundThemeProvider>
      <LogPastWorkoutScreen navigation={navigation} route={route} />
    </BackgroundThemeProvider>,
    { wrapper: TestProviders },
  );
}

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
  mockFetchAllCompletedWorkouts.mockReset().mockResolvedValue([]);
  mockFetchAllExerciseHistory.mockReset().mockResolvedValue([]);
  mockFetchAllRepPRs.mockReset().mockResolvedValue([]);
  mockFetchAllOneRepMaxes.mockReset().mockResolvedValue([]);
  mockCreateLoggedWorkout.mockReset().mockResolvedValue({
    id: 'w1',
    name: 'Leg Day',
    performedAt: '2026-01-05T12:00:00.000Z',
    completedAt: '2026-01-05T12:00:00.000Z',
    workoutSplitDayId: null,
  });
  mockAddExerciseToWorkout.mockReset().mockResolvedValue('we1');
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
  mockGoBack.mockClear();
  mockReplace.mockClear();
});

const squat = { id: 'ex-squat', name: 'Barbell Back Squat', muscleGroup: 'quadriceps' as const };
const splitSquat = {
  id: 'ex-split-squat',
  name: 'Bulgarian Split Squat',
  muscleGroup: 'quadriceps' as const,
  movementType: 'unilateral' as const,
};

// The very first exercise added to a freshly-rendered screen is always
// "local-1" -- LogPastWorkoutScreen's local-id counter starts at 0 and is
// only ever advanced by user actions, so this is deterministic per test
// (each test renders its own fresh screen instance).
const EX = 'log-past-workout-exercise-local-1';

async function addExerciseViaPicker(exercise: { id: string; name: string }) {
  fireEvent.press(screen.getByTestId('log-past-workout-add-exercise'));
  fireEvent.press(await screen.findByTestId(`exercise-picker-item-${exercise.id}`));
}

describe('LogPastWorkoutScreen -- date picker', () => {
  it('opens the calendar and updates the date row when a day is picked', async () => {
    renderScreen();
    await screen.findByTestId('log-past-workout-date');

    fireEvent.press(screen.getByTestId('log-past-workout-date'));
    fireEvent.press(await screen.findByTestId(`calendar-day-${FIXTURE_DATE_KEY}`));

    const expected = fixtureDate.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    await waitFor(() =>
      expect(screen.getByTestId('log-past-workout-date')).toHaveTextContent(expected, {
        exact: false,
      }),
    );
    expect(screen.queryByTestId('log-past-workout-calendar')).toBeNull();
  });
});

describe('LogPastWorkoutScreen -- exercises and sets', () => {
  it('adding an exercise starts it with exactly one blank bilateral set', async () => {
    mockFetchExercises.mockResolvedValue({ rows: [squat], hasMore: false });
    renderScreen();
    await screen.findByTestId('log-past-workout-date');

    await addExerciseViaPicker(squat);

    const block = await screen.findByTestId(EX);
    expect(within(block).getByText('Barbell Back Squat')).toBeTruthy();
    expect(screen.getByTestId(`${EX}-set-1-weight`)).toBeTruthy();
    expect(screen.getByTestId(`${EX}-set-1-reps`)).toBeTruthy();
    expect(screen.queryByTestId(`${EX}-set-2-weight`)).toBeNull();
  });

  it('Add Set appends another row; its remove button takes it back out', async () => {
    mockFetchExercises.mockResolvedValue({ rows: [squat], hasMore: false });
    renderScreen();
    await screen.findByTestId('log-past-workout-date');
    await addExerciseViaPicker(squat);

    fireEvent.press(screen.getByTestId(`${EX}-add-set`));

    expect(await screen.findByTestId(`${EX}-set-2-weight`)).toBeTruthy();

    fireEvent.press(screen.getByTestId(`${EX}-set-2-remove`));

    await waitFor(() => expect(screen.queryByTestId(`${EX}-set-2-weight`)).toBeNull());
    expect(screen.getByTestId(`${EX}-set-1-weight`)).toBeTruthy();
  });

  it('removing an exercise removes its whole block', async () => {
    mockFetchExercises.mockResolvedValue({ rows: [squat], hasMore: false });
    renderScreen();
    await screen.findByTestId('log-past-workout-date');
    await addExerciseViaPicker(squat);
    await screen.findByTestId(EX);

    fireEvent.press(screen.getByTestId(`${EX}-remove`));

    expect(screen.queryByText('Barbell Back Squat')).toBeNull();
    expect(screen.queryByTestId(EX)).toBeNull();
  });

  it('adds a unilateral exercise with a Left and Right row for its first set', async () => {
    mockFetchExercises.mockResolvedValue({ rows: [splitSquat], hasMore: false });
    renderScreen();
    await screen.findByTestId('log-past-workout-date');

    await addExerciseViaPicker(splitSquat);

    expect(await screen.findByTestId(`${EX}-set-1-left-weight`)).toBeTruthy();
    expect(screen.getByTestId(`${EX}-set-1-right-weight`)).toBeTruthy();
    expect(screen.getByText('Weight is per side')).toBeTruthy();

    fireEvent.press(screen.getByTestId(`${EX}-set-1-remove`));
    await waitFor(() => expect(screen.queryByTestId(`${EX}-set-1-left-weight`)).toBeNull());
  });
});

describe('LogPastWorkoutScreen -- validation and save', () => {
  it('blocks saving with no name', async () => {
    renderScreen();
    await screen.findByTestId('log-past-workout-date');

    fireEvent.press(screen.getByTestId('log-past-workout-save'));

    expect(await screen.findByTestId('log-past-workout-error')).toHaveTextContent(
      'Enter a name for this workout',
    );
    expect(mockCreateLoggedWorkout).not.toHaveBeenCalled();
  });

  it('blocks saving a named workout with no valid sets', async () => {
    mockFetchExercises.mockResolvedValue({ rows: [squat], hasMore: false });
    renderScreen();
    await screen.findByTestId('log-past-workout-date');
    fireEvent.changeText(screen.getByTestId('log-past-workout-name'), 'Leg Day');
    await addExerciseViaPicker(squat);

    fireEvent.press(screen.getByTestId('log-past-workout-save'));

    expect(await screen.findByTestId('log-past-workout-error')).toHaveTextContent(
      'Add at least one exercise with a weight and rep count',
    );
    expect(mockCreateLoggedWorkout).not.toHaveBeenCalled();
  });

  it('saves a fully-filled set, drops a second blank one left untouched, then navigates to Workout Detail', async () => {
    mockFetchExercises.mockResolvedValue({ rows: [squat], hasMore: false });
    renderScreen();
    await screen.findByTestId('log-past-workout-date');
    fireEvent.changeText(screen.getByTestId('log-past-workout-name'), 'Leg Day');
    await addExerciseViaPicker(squat);

    fireEvent.changeText(screen.getByTestId(`${EX}-set-1-weight`), '100');
    fireEvent.changeText(screen.getByTestId(`${EX}-set-1-reps`), '5');
    // A second, never-filled-in set -- should be silently dropped, not block the save.
    fireEvent.press(screen.getByTestId(`${EX}-add-set`));
    await screen.findByTestId(`${EX}-set-2-weight`);

    fireEvent.press(screen.getByTestId('log-past-workout-save'));

    await waitFor(() => expect(mockCreateLoggedWorkout).toHaveBeenCalled());
    expect(mockCreateLoggedWorkout).toHaveBeenCalledWith(
      'user-1',
      'Leg Day',
      expect.any(String),
      undefined,
    );
    expect(mockAddExerciseToWorkout).toHaveBeenCalledWith('w1', 'ex-squat', 1);
    expect(mockCreateSet).toHaveBeenCalledTimes(1);
    expect(mockCreateSet).toHaveBeenCalledWith('we1', 1, undefined);
    expect(mockUpdateSet).toHaveBeenCalledWith('set-1-none', {
      weightKg: 100,
      reps: 5,
      completedAt: expect.any(String),
    });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w1' }),
    );
  });

  it('computes a real completedAt from the entered duration, instead of leaving it equal to the date', async () => {
    mockFetchExercises.mockResolvedValue({ rows: [squat], hasMore: false });
    renderScreen();
    await screen.findByTestId('log-past-workout-date');
    fireEvent.changeText(screen.getByTestId('log-past-workout-name'), 'Leg Day');
    fireEvent.changeText(screen.getByTestId('log-past-workout-duration-hours'), '1');
    fireEvent.changeText(screen.getByTestId('log-past-workout-duration-minutes'), '26');
    await addExerciseViaPicker(squat);
    fireEvent.changeText(screen.getByTestId(`${EX}-set-1-weight`), '100');
    fireEvent.changeText(screen.getByTestId(`${EX}-set-1-reps`), '5');

    fireEvent.press(screen.getByTestId('log-past-workout-save'));

    await waitFor(() => expect(mockCreateLoggedWorkout).toHaveBeenCalled());
    const [, , performedAtIso, completedAtIso] = mockCreateLoggedWorkout.mock.calls[0];
    const minutesApart =
      (new Date(completedAtIso).getTime() - new Date(performedAtIso).getTime()) / 60000;
    expect(minutesApart).toBe(86); // 1h 26m
  });

  it('rejects a future date with an inline error instead of saving', async () => {
    mockFetchExercises.mockResolvedValue({ rows: [squat], hasMore: false });
    renderScreen();
    await screen.findByTestId('log-past-workout-date');
    fireEvent.changeText(screen.getByTestId('log-past-workout-name'), 'Leg Day');
    await addExerciseViaPicker(squat);
    fireEvent.changeText(screen.getByTestId(`${EX}-set-1-weight`), '100');
    fireEvent.changeText(screen.getByTestId(`${EX}-set-1-reps`), '5');

    fireEvent.press(screen.getByTestId('log-past-workout-date'));
    const nextMonthDate = new Date(CURRENT_YEAR, CURRENT_MONTH, 15);
    fireEvent.press(await screen.findByTestId('calendar-next-month'));
    fireEvent.press(await screen.findByTestId(`calendar-day-${toLocalDateKey(nextMonthDate)}`));

    fireEvent.press(screen.getByTestId('log-past-workout-save'));

    expect(await screen.findByTestId('log-past-workout-error')).toHaveTextContent(
      "Pick a date that's already happened",
    );
    expect(mockCreateLoggedWorkout).not.toHaveBeenCalled();
  });
});

describe('LogPastWorkoutScreen -- misc', () => {
  it('goes back via the header', async () => {
    renderScreen();
    await screen.findByTestId('log-past-workout-date');

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalledWith();
  });

  it('renders no bare text outside <Text>', async () => {
    mockFetchExercises.mockResolvedValue({ rows: [splitSquat], hasMore: false });
    renderScreen();
    await screen.findByTestId('log-past-workout-date');
    await addExerciseViaPicker(splitSquat);
    await screen.findByTestId(`${EX}-set-1-left-weight`);

    expectNoBareText();
  });
});
