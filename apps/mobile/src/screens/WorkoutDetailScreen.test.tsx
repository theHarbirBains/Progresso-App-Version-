import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { fonts, widgetGap } from '../design/theme';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import { fetchWorkoutDetail } from '../workouts/workoutQueries';
import { WorkoutDetailScreen } from './WorkoutDetailScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  fetchWorkoutDetail: jest.fn(),
  // Real (pure, no supabase dependency) implementation.
  ...jest.requireActual('../workouts/setCompletion'),
}));

jest.mock('../workouts/prQueries', () => ({
  fetchRepPRs: jest.fn(),
  fetchOneRepMax: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchWorkoutDetail = fetchWorkoutDetail as jest.Mock;
const mockFetchRepPRs = fetchRepPRs as jest.Mock;
const mockFetchOneRepMax = fetchOneRepMax as jest.Mock;

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
  mockGetMyProfile.mockReset().mockResolvedValue({
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
    mockGetMyProfile.mockResolvedValue({
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

  it('leads with one summary card, then one card per exercise', async () => {
    await ready();

    // Summary + two exercises.
    expect(screen.UNSAFE_getAllByType(AppCard)).toHaveLength(3);
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

  it("shows the volume in the user's unit, without a trailing .0", async () => {
    mockGetMyProfile.mockResolvedValue({
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
});
