import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { fonts, widgetGap } from '../design/theme';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { ProfileProvider } from '../profile/ProfileProvider';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import {
  fetchDurationRecord,
  fetchOneRepMax,
  fetchRepPRs,
  fetchRepRecord,
} from '../workouts/prQueries';
import { deleteWorkout, fetchWorkoutDetail } from '../workouts/workoutQueries';
import { WorkoutDetailScreen } from './WorkoutDetailScreen';
import { fetchMyProfile } from '../profile/profileQueries';
import { getGroup } from '../lib/api';

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  deleteWorkout: jest.fn().mockResolvedValue(undefined),
  fetchWorkoutDetail: jest.fn(),
  // Real (pure, no supabase dependency) implementation.
  ...jest.requireActual('../workouts/setCompletion'),
}));

jest.mock('../workouts/prQueries', () => ({
  fetchRepPRs: jest.fn(),
  fetchOneRepMax: jest.fn(),
  fetchRepRecord: jest.fn(),
  fetchDurationRecord: jest.fn(),
}));

jest.mock('../progress/AllTimeStatsProvider', () => ({
  useAllTimeStats: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getGroup: jest.fn(),
  // A followed person's workout, and any workout's likes and comments.
  getFriendWorkout: jest.fn(),
  getWorkoutSocial: jest.fn().mockResolvedValue({
    likeCount: 0,
    likedByMe: false,
    likers: [],
    comments: [],
  }),
  likeWorkout: jest.fn(),
  unlikeWorkout: jest.fn(),
  postComment: jest.fn(),
  deleteComment: jest.fn(),
}));

// Not a trainer, unless a test says so.
const mockListTrainerClients = jest.fn();
jest.mock('../lib/trainerApi', () => ({
  listTrainerClients: (...args: unknown[]) => mockListTrainerClients(...args),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockUseAllTimeStats = useAllTimeStats as jest.Mock;
const mockRefetchAllTimeStats = jest.fn();
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockFetchWorkoutDetail = fetchWorkoutDetail as jest.Mock;
const mockFetchRepPRs = fetchRepPRs as jest.Mock;
const mockFetchOneRepMax = fetchOneRepMax as jest.Mock;
const mockFetchRepRecord = fetchRepRecord as jest.Mock;
const mockFetchDurationRecord = fetchDurationRecord as jest.Mock;
const mockDeleteWorkout = deleteWorkout as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: mockNavigate };
const route = { params: { workoutId: 'w1' } } as never;

const workout = {
  id: 'w1',
  name: 'Push Day',
  performedAt: '2026-01-01T12:00:00Z',
  completedAt: '2026-01-01T13:00:00Z',
  exercises: [
    {
      id: 'we1',
      exerciseId: 'ex1',
      exerciseName: 'Bench Press',
      muscleGroup: 'chest' as const,
      orderIndex: 1,
      sets: [
        { id: 's1', setIndex: 1, weightKg: 100, reps: 10, completedAt: '2026-01-01T12:05:00Z' },
        { id: 's2', setIndex: 2, weightKg: 110, reps: 8, completedAt: '2026-01-01T12:10:00Z' },
      ],
    },
  ],
};

beforeEach(() => {
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
  });
  mockFetchWorkoutDetail.mockReset().mockResolvedValue(workout);
  mockFetchRepPRs.mockReset().mockResolvedValue([]);
  mockFetchOneRepMax.mockReset().mockResolvedValue(null);
  mockFetchRepRecord.mockReset().mockResolvedValue(null);
  mockFetchDurationRecord.mockReset().mockResolvedValue(null);
  mockDeleteWorkout.mockClear().mockResolvedValue(undefined);
  mockRefetchAllTimeStats.mockReset().mockResolvedValue(true);
  mockUseAllTimeStats.mockReturnValue({ refetch: mockRefetchAllTimeStats });
  mockGoBack.mockClear();
  mockNavigate.mockClear();
});

describe('WorkoutDetailScreen', () => {
  it('loads and displays the workout with its exercises and sets', async () => {
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByText('Push Day')).toBeTruthy();
    expect(screen.getByTestId('exercise-card-we1')).toHaveTextContent(/Bench Press/);
    expect(screen.getByText('Set 1')).toBeTruthy();
    expect(screen.getByText(/100kg × 10/)).toBeTruthy();
    expect(screen.getByText('Set 2')).toBeTruthy();
    expect(screen.getByText(/110kg × 8/)).toBeTruthy();
  });

  it("shows each exercise's photo, muscle, gym and handle, as the library does", async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...workout,
      exercises: [
        {
          ...workout.exercises[0],
          photoUrl: 'https://example.com/bench.jpg',
          gym: 'Fit4Less Downtown',
          attachment: 'Wide grip bar',
        },
      ],
    });
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('exercise-muscle-we1')).toHaveTextContent(
      'Chest · Fit4Less Downtown · Wide grip bar',
    );
    // Its photo opens full size; the title row still opens PR History.
    fireEvent.press(screen.getByTestId('exercise-photo-we1-zoom'));
    expect(screen.getByTestId('exercise-photo-we1-lightbox')).toBeTruthy();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('has a tab for each muscle group trained, from the start, each showing only its exercises', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...workout,
      exercises: [
        workout.exercises[0],
        {
          id: 'we2',
          exerciseId: 'ex2',
          exerciseName: 'Seated Row',
          muscleGroup: 'back' as const,
          orderIndex: 2,
          sets: [
            { id: 's3', setIndex: 1, weightKg: 60, reps: 10, completedAt: '2026-01-01T12:20:00Z' },
          ],
        },
        {
          id: 'we3',
          exerciseId: 'ex3',
          exerciseName: 'Incline Press',
          muscleGroup: 'chest' as const,
          orderIndex: 3,
          sets: [
            { id: 's4', setIndex: 1, weightKg: 80, reps: 8, completedAt: '2026-01-01T12:30:00Z' },
          ],
        },
      ],
    });
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    const tabs = await screen.findByTestId('workout-detail-muscle-tabs');
    // All, then each muscle once, in the order first trained.
    expect(tabs).toHaveTextContent(/^All.*Chest.*Back$/);
    expect(screen.getByTestId('exercise-card-we2')).toBeTruthy();

    fireEvent.press(screen.getByTestId('workout-detail-muscle-tabs-back'));

    expect(screen.getByTestId('exercise-card-we2')).toBeTruthy();
    expect(screen.queryByTestId('exercise-card-we1')).toBeNull();
    expect(screen.queryByTestId('exercise-card-we3')).toBeNull();

    fireEvent.press(screen.getByTestId('workout-detail-muscle-tabs-chest'));

    expect(screen.getByTestId('exercise-card-we1')).toBeTruthy();
    expect(screen.getByTestId('exercise-card-we3')).toBeTruthy();
    expect(screen.queryByTestId('exercise-card-we2')).toBeNull();
  });

  it('shows a pound user volume as a whole number, never a decimal like 3149.9', async () => {
    // 225 lb x 8 and 135 lb x 10, stored in kg (rounded to 2dp, as the
    // database does) -- the true total is 3,150 lb.
    mockFetchMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'lb',
    });
    mockFetchWorkoutDetail.mockResolvedValue({
      ...workout,
      exercises: [
        {
          ...workout.exercises[0],
          sets: [
            {
              id: 's1',
              setIndex: 1,
              weightKg: 102.06,
              reps: 8,
              completedAt: '2026-01-01T12:05:00Z',
            },
            {
              id: 's2',
              setIndex: 2,
              weightKg: 61.24,
              reps: 10,
              completedAt: '2026-01-01T12:10:00Z',
            },
          ],
        },
      ],
    });
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    await screen.findByText('Push Day');
    expect(screen.getByTestId('workout-detail-stat-volume')).toHaveTextContent(/^3,150 lb/);
    expect(screen.getByTestId('workout-detail-stat-volume')).not.toHaveTextContent(/\d\.\d/);
  });

  it('shows a bodyweight exercise by reps and a timed one by time, with records and no volume', async () => {
    const done = '2026-01-01T12:05:00Z';
    mockFetchWorkoutDetail.mockResolvedValue({
      ...workout,
      exercises: [
        {
          id: 'we-pushup',
          exerciseId: 'ex-pushup',
          exerciseName: 'Push-Up',
          muscleGroup: 'chest' as const,
          orderIndex: 1,
          measurementType: 'bodyweight' as const,
          sets: [
            // An older app could have sent a weight with push-ups: it isn't shown or weighed.
            { id: 'p1', setIndex: 1, weightKg: 80, reps: 20, completedAt: done },
            { id: 'p2', setIndex: 2, weightKg: null, reps: 25, completedAt: done },
          ],
        },
        {
          id: 'we-plank',
          exerciseId: 'ex-plank',
          exerciseName: 'Plank',
          muscleGroup: 'abs' as const,
          orderIndex: 2,
          measurementType: 'timed' as const,
          sets: [
            {
              id: 't1',
              setIndex: 1,
              weightKg: null,
              reps: null,
              durationSeconds: 90,
              completedAt: done,
            },
          ],
        },
      ],
    });
    mockFetchRepRecord.mockResolvedValue({ value: 25, sourceSetId: 'p2', achievedAt: done });
    mockFetchDurationRecord.mockResolvedValue({ value: 90, sourceSetId: 't1', achievedAt: done });
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('top-set-we-pushup')).toHaveTextContent('Best set: 25 reps');
    expect(screen.getByTestId('top-set-we-plank')).toHaveTextContent('Longest: 1:30');
    expect(screen.getByTestId('exercise-card-we-pushup')).toHaveTextContent(/20 reps/);
    expect(screen.getByTestId('exercise-card-we-pushup')).not.toHaveTextContent(/kg/);
    expect(screen.getByTestId('workout-detail-stat-sets')).toHaveTextContent(/^3/);
    expect(screen.getByTestId('workout-detail-stat-volume')).toHaveTextContent(/^0/);
    // Reps PR and longest-time record, from the database's records, never a weighted PR lookup.
    expect(await screen.findByTestId('pr-tag-p2')).toBeTruthy();
    expect(screen.getByTestId('pr-tag-t1')).toBeTruthy();
    expect(screen.queryByTestId('pr-tag-p1')).toBeNull();
    expect(mockFetchRepPRs).not.toHaveBeenCalled();
    // PR history is weighted only: the title opens nothing here.
    expect(screen.getByTestId('exercise-title-we-plank').props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('shows the computed top set', async () => {
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('top-set-we1')).toHaveTextContent('Top set: 110kg×8');
  });

  it('excludes a blank/incomplete set from the top set and the set list', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({
      ...workout,
      exercises: [
        {
          ...workout.exercises[0],
          sets: [
            ...workout.exercises[0].sets,
            { id: 's3', setIndex: 3, weightKg: 999, reps: 99, completedAt: null },
          ],
        },
      ],
    });

    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('top-set-we1')).toHaveTextContent('Top set: 110kg×8');
    expect(screen.queryByText(/999/)).toBeNull();
  });

  it("displays weights converted to the user's preferred unit", async () => {
    mockFetchMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'lb',
    });

    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('top-set-we1')).toHaveTextContent(/lb/);
  });

  it('shows an error message when loading fails', async () => {
    mockFetchWorkoutDetail.mockRejectedValue(new Error('network error'));

    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-detail-error')).toHaveTextContent('network error');
  });

  it('goes back when Back is pressed', async () => {
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByText('Push Day');

    fireEvent.press(screen.getByTestId('workout-detail-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows a Share action for a completed workout and navigates to ShareWorkout', async () => {
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByText('Push Day');

    fireEvent.press(screen.getByTestId('workout-detail-share'));

    expect(mockNavigate).toHaveBeenCalledWith('ShareWorkout', { workoutId: 'w1' });
  });

  it('hides the Share action for an incomplete (active) workout', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({ ...workout, completedAt: null });

    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByText('Push Day');

    expect(screen.queryByTestId('workout-detail-share')).toBeNull();
  });

  it('always shows an Edit action and navigates to EditWorkout', async () => {
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByText('Push Day');

    fireEvent.press(screen.getByTestId('workout-detail-edit'));

    expect(mockNavigate).toHaveBeenCalledWith('EditWorkout', { workoutId: 'w1' });
  });

  it('shows the Edit action even for an incomplete (active) workout', async () => {
    mockFetchWorkoutDetail.mockResolvedValue({ ...workout, completedAt: null });

    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByText('Push Day');

    expect(screen.getByTestId('workout-detail-edit')).toBeTruthy();
  });
});

describe('WorkoutDetailScreen current PR/1RM indicators', () => {
  it('tags the set that is still the current database rep-count record as a PR', async () => {
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, bestWeightKg: 110, sourceSetId: 's2', achievedAt: '2026-01-01T00:00:00Z' },
    ]);

    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('pr-tag-s2')).toHaveTextContent(/PR/);
    expect(screen.queryByTestId('pr-tag-s1')).toBeNull();
  });

  it('does not tag a set that has since been superseded by a later PR', async () => {
    // A heavier 8-rep set was logged in a later workout -- source_set_id no
    // longer points at s2, so this historical set must not claim "PR".
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, bestWeightKg: 120, sourceSetId: 'later-set', achievedAt: '2026-02-01T00:00:00Z' },
    ]);

    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByText('Push Day');

    expect(screen.queryByTestId('pr-tag-s2')).toBeNull();
  });

  it('tags the set that is the current true 1RM as 1RM', async () => {
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 110,
      sourceSetId: 's2',
      achievedAt: '2026-01-01T00:00:00Z',
    });

    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('pr-tag-s2')).toHaveTextContent(/1RM/);
  });

  it('navigates to PRHistory when an exercise title is pressed', async () => {
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByText('Push Day');

    fireEvent.press(screen.getByTestId('exercise-title-we1'));

    expect(mockNavigate).toHaveBeenCalledWith('PRHistory', {
      exerciseId: 'ex1',
      exerciseName: 'Bench Press',
    });
  });
});

describe('WorkoutDetailScreen -- a stack of widgets', () => {
  const twoExercises = {
    ...workout,
    exercises: [
      ...workout.exercises,
      {
        id: 'we2',
        exerciseId: 'ex2',
        exerciseName: 'Overhead Press',
        muscleGroup: 'shoulders' as const,
        orderIndex: 2,
        sets: [
          { id: 's9', setIndex: 1, weightKg: 60, reps: 8, completedAt: '2026-01-01T12:30:00Z' },
        ],
      },
    ],
  };

  async function ready(detail = twoExercises) {
    mockFetchWorkoutDetail.mockResolvedValue(detail);
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
    await screen.findByTestId('exercise-card-we2');
  }

  it('leads with one summary card, then one card per exercise, then its likes and comments', async () => {
    await ready();
    await screen.findByTestId('workout-comments');

    // Summary + two exercises + likes and comments.
    expect(screen.UNSAFE_getAllByType(AppCard)).toHaveLength(4);
    expect(screen.getByTestId('workout-detail-summary')).toBeTruthy();
  });

  it('bands the summary card in the Workout accent, like a Feed activity card', async () => {
    await ready();

    const band = StyleSheet.flatten(
      screen.getByTestId('workout-detail-summary-top-accent').props.style,
    );
    expect(band.backgroundColor).toBe(DEFAULT_WORKOUT_THEME.accent);
  });

  it('separates the widgets by exactly the widget gap, with no per-widget margin', async () => {
    await ready();

    const scroll = screen.getByTestId('workout-detail-summary').parent!.parent!;
    const contentStyle = Object.assign(
      {},
      ...[scroll.props.contentContainerStyle ?? scroll.props.style].flat(Infinity),
    );
    expect(contentStyle.gap ?? widgetGap).toBe(widgetGap);
    const style = StyleSheet.flatten(screen.getByTestId('exercise-card-we2').props.style) ?? {};
    expect(style.marginBottom ?? 0).toBe(0);
  });

  it('summarises the workout: muscles, duration, sets, volume and records', async () => {
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, bestWeightKg: 110, sourceSetId: 's2', achievedAt: '2026-01-01T00:00:00Z' },
    ]);
    await ready();

    const summary = within(screen.getByTestId('workout-detail-summary'));
    expect(summary.getByText(/Chest.*Shoulders/)).toBeTruthy();
    expect(screen.getByTestId('workout-detail-stat-duration')).toHaveTextContent(/1h 0m/);
    expect(screen.getByTestId('workout-detail-stat-sets')).toHaveTextContent(/^3/);
    // 100x10 + 110x8 + 60x8 = 2,360 kg
    expect(screen.getByTestId('workout-detail-stat-volume')).toHaveTextContent(/2,360 kg/);
    expect(await screen.findByTestId('workout-detail-stat-records')).toHaveTextContent(/^1/);
  });

  it('shows a warm-up, labelled, but never counts it in the sets or the volume', async () => {
    const withWarmup = {
      ...twoExercises,
      exercises: twoExercises.exercises.map((exercise, i) =>
        i === 0
          ? {
              ...exercise,
              sets: [
                {
                  id: 'w0',
                  setIndex: 0,
                  weightKg: 60,
                  reps: 10,
                  completedAt: '2026-01-01T12:01:00Z',
                  isWarmup: true,
                },
                ...exercise.sets,
              ],
            }
          : exercise,
      ),
    };
    await ready(withWarmup);

    expect(screen.getByTestId('set-label-w0')).toHaveTextContent('Warm-up');
    // Still 3 sets and 2,360 kg: the 60 kg x 10 warm-up counts toward nothing.
    expect(screen.getByTestId('workout-detail-stat-sets')).toHaveTextContent(/^3/);
    expect(screen.getByTestId('workout-detail-stat-volume')).toHaveTextContent(/2,360 kg/);
  });

  it('shows a drop set under its set, adding its volume but never counting it as a set', async () => {
    const withDrop = {
      ...twoExercises,
      exercises: twoExercises.exercises.map((exercise) =>
        exercise.id === 'we2'
          ? {
              ...exercise,
              sets: [
                ...exercise.sets,
                {
                  id: 'd9',
                  setIndex: 2,
                  weightKg: 40,
                  reps: 8,
                  completedAt: '2026-01-01T12:31:00Z',
                  isDrop: true,
                },
              ],
            }
          : exercise,
      ),
    };
    await ready(withDrop);

    expect(screen.getByTestId('set-label-s9')).toHaveTextContent('Set 1');
    expect(screen.getByTestId('set-label-d9')).toHaveTextContent('Drop');
    // Still 3 sets; the 40 kg x 8 drop adds 320 kg to the 2,360 kg.
    expect(screen.getByTestId('workout-detail-stat-sets')).toHaveTextContent(/^3/);
    expect(screen.getByTestId('workout-detail-stat-volume')).toHaveTextContent(/2,680 kg/);
    expect(screen.getByTestId('top-set-we2')).toHaveTextContent(/60/);
  });

  it('shows its cardio, and its time told apart: strength, each activity, active and the session', async () => {
    const treadmill = {
      id: 'c1',
      workoutId: 'w1',
      activity: 'treadmill' as const,
      name: null,
      durationSeconds: 900,
      distanceM: 2000,
      calories: 140,
      speedKmh: 8,
      inclinePercent: 3,
      resistanceLevel: null,
      floors: null,
      afterStrength: true,
      createdAt: '2026-01-01T12:42:00Z',
    };
    // Lifted until 40 min in, then 15 on the treadmill; finished at an hour.
    await ready({
      ...twoExercises,
      strengthEndedAt: '2026-01-01T12:40:00Z',
      cardio: [treadmill],
    } as typeof twoExercises);

    // Saved before calories went and treadmill speeds were the machine's number: its calories
    // stay unshown, its speed in km/h -- kilometres for everyone.
    expect(screen.getByTestId('workout-detail-cardio-entry-c1')).toHaveTextContent(
      /Treadmill.*15 min · 2 km · 8 km\/h · 3% incline$/,
    );
    expect(screen.queryByText(/\bcal\b/)).toBeNull();
    expect(screen.getByTestId('workout-detail-cardio-strength')).toHaveTextContent(/40 min/);
    expect(screen.getByTestId('workout-detail-cardio-time-c1')).toHaveTextContent(/15 min/);
    expect(screen.getByTestId('workout-detail-cardio-active')).toHaveTextContent(/55 min/);
    expect(screen.getByTestId('workout-detail-cardio-session')).toHaveTextContent(/1h 0m/);
    // Its figure is the active time, not the session's; cardio is never a set or volume.
    expect(screen.getByTestId('workout-detail-stat-active')).toHaveTextContent(/55 min/);
    expect(screen.getByTestId('workout-detail-stat-sets')).toHaveTextContent(/^3/);
    expect(screen.getByTestId('workout-detail-stat-volume')).toHaveTextContent(/2,360 kg/);
  });

  it('shows a workout of cardio alone with its cardio time and activities', async () => {
    const walk = {
      id: 'c2',
      workoutId: 'w1',
      activity: 'walking' as const,
      name: null,
      durationSeconds: 2400,
      distanceM: null,
      calories: null,
      speedKmh: null,
      inclinePercent: null,
      resistanceLevel: null,
      floors: null,
      afterStrength: false,
      createdAt: '2026-01-01T12:01:00Z',
    };
    mockFetchWorkoutDetail.mockResolvedValue({ ...workout, exercises: [], cardio: [walk] });
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-detail-stat-active')).toHaveTextContent(/40 min/);
    expect(screen.getByTestId('workout-detail-stat-activities')).toHaveTextContent(/1/);
    expect(screen.queryByTestId('workout-detail-stat-sets')).toBeNull();
    expect(screen.queryByTestId('workout-detail-cardio-strength')).toBeNull();
    expect(screen.getByTestId('workout-detail-cardio-active')).toHaveTextContent(/40 min/);
  });

  it('leaves Duration out of a workout logged with none, the other figures on one row', async () => {
    await ready({ ...twoExercises, completedAt: twoExercises.performedAt });

    expect(screen.queryByTestId('workout-detail-stat-duration')).toBeNull();
    expect(screen.getByTestId('workout-detail-stat-sets')).toHaveTextContent(/^3/);
    expect(screen.getByTestId('workout-detail-stat-volume')).toBeTruthy();
    expect(await screen.findByTestId('workout-detail-stat-records')).toBeTruthy();
  });

  it("shows the volume in the user's unit, without a trailing .0", async () => {
    mockFetchMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'lb',
    });
    await ready();

    const volume = screen.getByTestId('workout-detail-stat-volume');
    expect(volume).toHaveTextContent(/lb/);
    expect(volume).not.toHaveTextContent(/\.0\b/);
  });

  it("calls out each exercise's top set on its own block, in the mode accent and the mono face", async () => {
    await ready();

    const top = StyleSheet.flatten(screen.getByTestId('top-set-we1').props.style);
    expect(top.color).toBe(DEFAULT_WORKOUT_THEME.accent);
    expect(top.fontFamily).toBe(fonts.monoBold);
    expect(screen.getByTestId('top-set-we1')).toHaveTextContent('Top set: 110kg×8');
  });

  it("shows each exercise's muscle group and one row per logged set, hairline-separated", async () => {
    await ready();

    const card = within(screen.getByTestId('exercise-card-we1'));
    expect(card.getByText('Chest')).toBeTruthy();
    expect(card.getByText('Set 1')).toBeTruthy();
    expect(card.getByText('Set 2')).toBeTruthy();
    expect(card.getByText(/100kg × 10/)).toBeTruthy();
  });

  it('badges a live PR (and a 1RM) on its set, in the mode accent', async () => {
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, bestWeightKg: 110, sourceSetId: 's2', achievedAt: '2026-01-01T00:00:00Z' },
    ]);
    await ready();

    const badge = await screen.findByTestId('pr-tag-s2');
    expect(badge).toHaveTextContent('PR');
    expect(within(badge).getByText('PR')).toBeTruthy();
    expect(screen.queryByTestId('pr-tag-s1')).toBeNull();
  });

  it('makes each exercise name a named 44pt row that opens its PR history', async () => {
    await ready();

    const title = screen.getByTestId('exercise-title-we1');
    expect(title.props.accessibilityLabel).toBe('Bench Press, view PR history');
    expect(StyleSheet.flatten(title.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('puts the workout name and date in the header, with a named Back and Share', async () => {
    await ready();

    expect(screen.getByText('Push Day')).toBeTruthy();
    expect(screen.getByTestId('workout-detail-back').props.accessibilityLabel).toBe('Back');
    expect(screen.getByTestId('workout-detail-share').props.accessibilityLabel).toBe(
      'Share workout',
    );
  });

  it('renders no bare text outside <Text>', async () => {
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 110,
      sourceSetId: 's2',
      achievedAt: '2026-01-01T00:00:00Z',
    });
    await ready();
    await screen.findByTestId('pr-tag-s2');

    expectNoBareText();
  });

  it('lets a trainer delete this client workout from its own screen, once confirmed', async () => {
    const { Alert } = jest.requireActual('react-native');
    const { deleteWorkout } = jest.requireMock('../workouts/workoutQueries') as {
      deleteWorkout: jest.Mock;
    };
    const alert = jest.spyOn(Alert, 'alert');
    render(
      <WorkoutDetailScreen
        navigation={navigation}
        route={{ params: { workoutId: 'w1', clientId: 'client-1', clientName: 'Sam' } } as never}
      />,
      { wrapper: ProfileProvider },
    );

    fireEvent.press(await screen.findByTestId('workout-detail-delete'));
    expect(deleteWorkout).not.toHaveBeenCalled();
    // A client's workout, not the trainer's own -- the confirmation reads "the client's history".
    expect(alert.mock.calls[0][1]).toMatch(/client.s history/);
    const buttons = (alert.mock.calls[0][2] ?? []) as { text?: string; onPress?: () => void }[];
    buttons.find((button) => button.text === 'Delete')?.onPress?.();

    await waitFor(() => expect(deleteWorkout).toHaveBeenCalledWith('w1'));
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    // The client's workout never counted toward the trainer's own stats.
    expect(mockRefetchAllTimeStats).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('lets the user delete their own workout, once confirmed', async () => {
    const { Alert } = jest.requireActual('react-native');
    const { deleteWorkout } = jest.requireMock('../workouts/workoutQueries') as {
      deleteWorkout: jest.Mock;
    };
    const alert = jest.spyOn(Alert, 'alert');
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    fireEvent.press(await screen.findByTestId('workout-detail-delete'));
    expect(deleteWorkout).not.toHaveBeenCalled();
    // Own workout, not a client's -- the confirmation reads "your history", not "the client's".
    expect(alert.mock.calls[0][1]).toMatch(/your history/);
    const buttons = (alert.mock.calls[0][2] ?? []) as { text?: string; onPress?: () => void }[];
    buttons.find((button) => button.text === 'Delete')?.onPress?.();

    await waitFor(() => expect(deleteWorkout).toHaveBeenCalledWith('w1'));
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    // Profile stats, Progress and PRs drop the deleted workout right away.
    expect(mockRefetchAllTimeStats).toHaveBeenCalledTimes(1);
    alert.mockRestore();
  });

  it('keeps the stats untouched when the delete fails', async () => {
    const { Alert } = jest.requireActual('react-native');
    mockDeleteWorkout.mockRejectedValueOnce(new Error('Network down'));
    const alert = jest.spyOn(Alert, 'alert');
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    fireEvent.press(await screen.findByTestId('workout-detail-delete'));
    const buttons = (alert.mock.calls[0][2] ?? []) as { text?: string; onPress?: () => void }[];
    buttons.find((button) => button.text === 'Delete')?.onPress?.();

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Could not delete', 'Network down'));
    expect(mockRefetchAllTimeStats).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});

describe('WorkoutDetailScreen -- a group workout', () => {
  const mine = { ...workout, groupId: 'g1' };
  const jashans = {
    id: 'w-jashan',
    name: 'Pull Day',
    performedAt: '2026-01-01T12:00:00Z',
    completedAt: '2026-01-01T13:00:00Z',
    groupId: 'g1',
    exercises: [
      {
        id: 'we-j1',
        exerciseId: 'ex-row',
        exerciseName: 'Barbell Row',
        muscleGroup: 'back' as const,
        orderIndex: 1,
        sets: [
          { id: 'sj1', setIndex: 1, weightKg: 80, reps: 8, completedAt: '2026-01-01T12:05:00Z' },
        ],
      },
    ],
  };
  // The trainer who ran it and only coached: nothing of their own logged.
  const coachs = { ...jashans, id: 'w-coach', name: 'Coaching', exercises: [] };

  function member(userId: string, displayName: string, workoutId: string) {
    return {
      userId,
      displayName,
      role: 'member',
      status: 'joined',
      isGuest: false,
      workoutId,
      workoutSplitDayId: null,
      workoutName: null,
    };
  }

  beforeEach(() => {
    mockListTrainerClients.mockReset().mockRejectedValue(new Error('Not a trainer'));
    jest.mocked(getGroup).mockResolvedValue({
      id: 'g1',
      name: 'Thursday',
      status: 'finished',
      hostId: 'coach',
      startedAt: '2026-01-01T12:00:00Z',
      finishedAt: '2026-01-01T13:00:00Z',
      members: [
        member('coach', 'Coach Sam', 'w-coach'),
        member('user-1', 'Harbir Bains', 'w1'),
        member('jashan', 'Jashan Singh', 'w-jashan'),
      ],
    } as never);
    mockFetchWorkoutDetail.mockImplementation(async (id: string) =>
      id === 'w1' ? mine : id === 'w-jashan' ? jashans : coachs,
    );
  });

  function renderGroup() {
    return render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });
  }

  it('has a tab for each person who trained, yours first chosen -- the coach who logged nothing has none', async () => {
    renderGroup();

    expect(await screen.findByTestId('workout-detail-people-w1')).toHaveTextContent(/You/);
    expect(screen.getByTestId('workout-detail-people-w-jashan')).toHaveTextContent(/Jashan/);
    expect(screen.queryByTestId('workout-detail-people-w-coach')).toBeNull();
    expect(screen.getByTestId('exercise-card-we1')).toHaveTextContent(/Bench Press/);
    expect(getGroup).toHaveBeenCalledWith('token-123', 'g1');
  });

  it("shows another person's workout as they logged it, read-only and without your records", async () => {
    renderGroup();
    fireEvent.press(await screen.findByTestId('workout-detail-people-w-jashan'));

    expect(screen.getByTestId('workout-detail-person-workout')).toHaveTextContent('Pull Day');
    expect(screen.getByTestId('exercise-card-we-j1')).toHaveTextContent(/Barbell Row/);
    expect(screen.getByText(/80kg × 8/)).toBeTruthy();
    expect(screen.queryByTestId('exercise-card-we1')).toBeNull();
    // Theirs to edit, share or delete, not yours.
    expect(screen.queryByTestId('workout-detail-edit')).toBeNull();
    expect(screen.queryByTestId('workout-detail-share')).toBeNull();
    expect(screen.queryByTestId('workout-detail-delete')).toBeNull();
    expect(screen.queryByTestId('workout-detail-stat-records')).toBeNull();
    expect(screen.getByTestId('workout-detail-stat-exercises')).toHaveTextContent(/^1/);
    expectNoBareText();

    fireEvent.press(screen.getByTestId('workout-detail-people-w1'));
    expect(screen.getByTestId('workout-detail-share')).toBeTruthy();
  });

  it("lets their trainer edit a client's workout from the client's tab, to fix a set logged wrong", async () => {
    mockListTrainerClients.mockResolvedValue([
      { clientId: 'jashan', status: 'active' },
      { clientId: 'someone-else', status: 'pending' },
    ]);
    renderGroup();
    fireEvent.press(await screen.findByTestId('workout-detail-people-w-jashan'));

    const edit = await screen.findByTestId('workout-detail-edit');
    expect(edit.props.accessibilityLabel).toBe("Edit Jashan's workout");
    fireEvent.press(edit);

    expect(mockNavigate).toHaveBeenCalledWith('EditWorkout', {
      workoutId: 'w-jashan',
      clientId: 'jashan',
      clientName: 'Jashan Singh',
    });
    // Still theirs to share or delete.
    expect(screen.queryByTestId('workout-detail-share')).toBeNull();
    expect(screen.queryByTestId('workout-detail-delete')).toBeNull();
    expect(mockListTrainerClients).toHaveBeenCalledWith('token-123');
  });

  it("offers a trainer no edit on someone in the group who isn't their active client", async () => {
    mockListTrainerClients.mockResolvedValue([{ clientId: 'jashan', status: 'pending' }]);
    renderGroup();
    fireEvent.press(await screen.findByTestId('workout-detail-people-w-jashan'));
    await waitFor(() => expect(mockListTrainerClients).toHaveBeenCalled());

    expect(screen.queryByTestId('workout-detail-edit')).toBeNull();
  });

  it("shows only this workout when the group can't be read -- a trainer who wasn't in it", async () => {
    jest.mocked(getGroup).mockRejectedValue(new Error('Not in this group'));
    renderGroup();

    expect(await screen.findByTestId('exercise-card-we1')).toBeTruthy();
    await waitFor(() => expect(getGroup).toHaveBeenCalled());
    expect(screen.queryByTestId('workout-detail-people')).toBeNull();
  });

  it('offers no share card for a workout with nothing logged in it', async () => {
    mockFetchWorkoutDetail.mockImplementation(async () => ({ ...coachs, id: 'w1', groupId: null }));
    renderGroup();

    expect(await screen.findByTestId('workout-detail-summary')).toBeTruthy();
    expect(screen.queryByTestId('workout-detail-share')).toBeNull();
  });
});

describe("WorkoutDetailScreen -- a friend's workout", () => {
  const theirs = {
    id: 'fw1',
    name: 'Pull Day',
    performedAt: '2026-01-01T12:00:00Z',
    completedAt: '2026-01-01T13:00:00Z',
    author: { id: 'sam', username: 'sam', displayName: 'Sam Lee', avatarUrl: null },
    exercises: [
      {
        id: 'we-f1',
        exerciseId: 'ex-row',
        exerciseName: 'Seated Row',
        muscleGroup: 'back',
        movementType: 'bilateral',
        measurementType: 'weight_reps',
        photoUrl: null,
        gym: 'Downtown',
        attachment: 'V-handle',
        orderIndex: 1,
        sets: [
          {
            id: 'fs1',
            setIndex: 1,
            side: null,
            weightKg: 80,
            reps: 10,
            durationSeconds: null,
            completedAt: '2026-01-01T12:05:00Z',
          },
        ],
      },
    ],
  };

  it('reads it through the API, read-only, saying whose it is -- with its likes and comments', async () => {
    const { getFriendWorkout } = jest.requireMock('../lib/api') as { getFriendWorkout: jest.Mock };
    getFriendWorkout.mockResolvedValue(theirs);
    mockFetchWorkoutDetail.mockClear();
    render(
      <WorkoutDetailScreen
        navigation={navigation}
        route={{ params: { workoutId: 'fw1', authorId: 'sam' } } as never}
      />,
      { wrapper: ProfileProvider },
    );

    expect(await screen.findByTestId('workout-detail-author')).toHaveTextContent(
      "Sam Lee's workout",
    );
    expect(screen.getByTestId('exercise-card-we-f1')).toHaveTextContent(/Seated Row/);
    expect(screen.getByTestId('exercise-muscle-we-f1')).toHaveTextContent(
      'Back · Downtown · V-handle',
    );
    expect(screen.getByText(/80kg × 10/)).toBeTruthy();
    expect(mockFetchWorkoutDetail).not.toHaveBeenCalled();
    // Theirs: nothing to edit, share or delete.
    expect(screen.queryByTestId('workout-detail-edit')).toBeNull();
    expect(screen.queryByTestId('workout-detail-share')).toBeNull();
    expect(screen.queryByTestId('workout-detail-delete')).toBeNull();
    expect(await screen.findByTestId('workout-comments')).toBeTruthy();

    fireEvent.press(screen.getByTestId('workout-detail-author'));
    expect(mockNavigate).toHaveBeenCalledWith('PersonProfile', { userId: 'sam' });
  });

  it('has likes and comments on your own finished workout too', async () => {
    render(<WorkoutDetailScreen navigation={navigation} route={route} />, {
      wrapper: ProfileProvider,
    });

    expect(await screen.findByTestId('workout-comments')).toBeTruthy();
  });
});
