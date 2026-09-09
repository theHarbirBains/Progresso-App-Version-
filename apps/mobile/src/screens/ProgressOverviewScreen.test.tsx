import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fetchAllCompletedWorkouts } from '../progress/progressStatsQueries';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { fetchAllOneRepMaxes, fetchAllRepPRs } from '../workouts/prSummaryQueries';
import { ProgressOverviewScreen } from './ProgressOverviewScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../workouts/allExerciseHistoryQueries', () => ({
  fetchAllExerciseHistory: jest.fn(),
  groupByExercise: jest.requireActual('../workouts/exerciseHistoryGrouping').groupByExercise,
}));

jest.mock('../workouts/prSummaryQueries', () => ({
  fetchAllRepPRs: jest.fn(),
  fetchAllOneRepMaxes: jest.fn(),
}));

jest.mock('../progress/progressStatsQueries', () => ({
  fetchAllCompletedWorkouts: jest.fn(),
  fetchWorkoutIdForSet: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchAllExerciseHistory = fetchAllExerciseHistory as jest.Mock;
const mockFetchAllRepPRs = fetchAllRepPRs as jest.Mock;
const mockFetchAllOneRepMaxes = fetchAllOneRepMaxes as jest.Mock;
const mockFetchAllCompletedWorkouts = fetchAllCompletedWorkouts as jest.Mock;

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

function goToSection(section: string) {
  fireEvent.press(screen.getByTestId(`progress-tabs-${section}`));
}

const benchHistory = [
  {
    weightKg: 100,
    reps: 5,
    performedAt: '2026-01-01T12:00:00Z',
    workoutExerciseId: 'we1',
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
  },
  {
    weightKg: 120,
    reps: 5,
    performedAt: '2026-02-15T12:00:00Z',
    workoutExerciseId: 'we3',
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
  },
];

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
  });
  mockFetchAllExerciseHistory.mockReset().mockResolvedValue([]);
  mockFetchAllRepPRs.mockReset().mockResolvedValue([]);
  mockFetchAllOneRepMaxes.mockReset().mockResolvedValue([]);
  mockFetchAllCompletedWorkouts.mockReset().mockResolvedValue([]);
  mockNavigate.mockClear();
});

describe('ProgressOverviewScreen shell', () => {
  it('shows the header title and subtitle', async () => {
    render(<ProgressOverviewScreen navigation={navigation} route={route} />);

    expect(await screen.findByText('Progress')).toBeTruthy();
    expect(screen.getByTestId('progress-header-subtitle')).toHaveTextContent(
      "Track how you're getting stronger.",
    );
  });

  it('lists all six sections, defaulting to Overview', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    render(<ProgressOverviewScreen navigation={navigation} route={route} />);
    await screen.findByTestId('progress-tabs');

    for (const section of ['Overview', 'Strength', 'PRs', 'Exercises', 'TopSets', 'OneRepMax']) {
      expect(screen.getByTestId(`progress-tabs-${section}`)).toBeTruthy();
    }
    expect(await screen.findByTestId('progress-overview-scroll')).toBeTruthy();
  });

  it('switches sections without losing the tab bar, and never re-fetches', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    render(<ProgressOverviewScreen navigation={navigation} route={route} />);
    await screen.findByTestId('progress-overview-scroll');
    // The navigation mock's addListener fires its callback once immediately
    // on registration (simulating the initial focus) on top of the effect's
    // own direct call -- this is the real baseline for one mount, not a bug.
    const callsAfterMount = mockFetchAllExerciseHistory.mock.calls.length;

    goToSection('PRs');
    expect(screen.getByTestId('progress-tabs')).toBeTruthy();
    expect(screen.queryByTestId('progress-overview-scroll')).toBeNull();

    goToSection('Overview');
    expect(await screen.findByTestId('progress-overview-scroll')).toBeTruthy();

    // Switching tabs must not trigger any new data fetch -- everything was
    // already loaded once by the shell.
    expect(mockFetchAllExerciseHistory.mock.calls.length).toBe(callsAfterMount);
  });

  it('shows a load error without crashing the shell', async () => {
    mockFetchAllExerciseHistory.mockRejectedValue(new Error('network down'));

    render(<ProgressOverviewScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('progress-overview-error')).toHaveTextContent('network down');
    expect(screen.getByTestId('progress-tabs')).toBeTruthy();
  });

  it('shows each section’s distinctive content when selected', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    mockFetchAllOneRepMaxes.mockResolvedValue([
      {
        weightKg: 140,
        sourceSetId: 'set-orm',
        achievedAt: '2026-02-20T12:00:00Z',
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
      },
    ]);
    render(<ProgressOverviewScreen navigation={navigation} route={route} />);
    await screen.findByTestId('progress-overview-scroll');

    goToSection('Strength');
    expect(await screen.findByTestId('progress-strength-scroll')).toBeTruthy();

    goToSection('PRs');
    expect(await screen.findByTestId('progress-prs-list')).toBeTruthy();

    goToSection('Exercises');
    expect(await screen.findByTestId('progress-exercises-search')).toBeTruthy();

    goToSection('TopSets');
    expect(await screen.findByTestId('progress-topsets-search')).toBeTruthy();

    goToSection('OneRepMax');
    expect(await screen.findByTestId('progress-1rm-list')).toBeTruthy();
  });
});
