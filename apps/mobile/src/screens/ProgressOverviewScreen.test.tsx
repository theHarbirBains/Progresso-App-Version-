import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
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

const mockOpenMenu = jest.fn();

// ProgressOverviewScreen now opens the app-level side menu (via
// AppMenuContext) from its own header, same as Dashboard -- this stands in
// for that root-level provider.
function renderScreen(currentMode: 'workout' | 'nutrition' = 'workout') {
  return render(
    <AppMenuContext.Provider
      value={{ openMenu: mockOpenMenu, currentMode }}
    >
      <ProgressOverviewScreen navigation={navigation} route={route} />
    </AppMenuContext.Provider>,
  );
}

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
    movementType: 'bilateral',
  },
  {
    weightKg: 120,
    reps: 5,
    performedAt: '2026-02-15T12:00:00Z',
    workoutExerciseId: 'we3',
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
  },
];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

// Four sessions inside the default 4-week range, a clear (20%) weight
// gain -- qualifies as "significant" per strengthProgress.ts, so the
// featured card/chart actually render instead of the empty state.
const meaningfulBenchHistory = [
  {
    weightKg: 100,
    reps: 8,
    performedAt: daysAgo(20),
    workoutExerciseId: 'we1',
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
  },
  {
    weightKg: 108,
    reps: 8,
    performedAt: daysAgo(15),
    workoutExerciseId: 'we2',
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
  },
  {
    weightKg: 115,
    reps: 8,
    performedAt: daysAgo(10),
    workoutExerciseId: 'we3',
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
  },
  {
    weightKg: 120,
    reps: 8,
    performedAt: daysAgo(5),
    workoutExerciseId: 'we4',
    exerciseId: 'ex-bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
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
  mockOpenMenu.mockClear();
});

describe('ProgressOverviewScreen shell', () => {
  it('shows the centered "Progress" title', async () => {
    renderScreen();

    expect(await screen.findByText('Progress')).toBeTruthy();
  });

  it('hides the "Track Your Growth" heading and supporting text on the Overview tab, which already shows its own stat card', async () => {
    renderScreen();
    await screen.findByText('Progress');

    expect(screen.queryByText('PROGRESS')).toBeNull();
    expect(screen.queryByText('Track Your Growth')).toBeNull();
    expect(screen.queryByTestId('progress-header-subtitle')).toBeNull();
  });

  it('hides the "Track Your Growth" heading and supporting text on every tab, not just Overview', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    renderScreen();
    await screen.findByTestId('progress-overview-scroll');

    goToSection('Strength');
    expect(screen.queryByText('PROGRESS')).toBeNull();
    expect(screen.queryByText('Track Your Growth')).toBeNull();
    expect(screen.queryByTestId('progress-header-subtitle')).toBeNull();

    goToSection('TopSets');
    expect(screen.queryByText('PROGRESS')).toBeNull();
    expect(screen.queryByText('Track Your Growth')).toBeNull();
    expect(screen.queryByTestId('progress-header-subtitle')).toBeNull();
  });

  it('opens the app-level side menu when the header button is pressed', async () => {
    renderScreen();
    await screen.findByText('Progress');

    fireEvent.press(screen.getByTestId('progress-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith();
  });

  // Regression coverage: Progress previously showed a "Nutrition progress is
  // coming soon" placeholder (and hid its own section tabs) whenever
  // `currentMode` was 'nutrition' -- a leftover from the removed Workout/
  // Nutrition toggle that made this screen's content depend on unrelated
  // prior navigation (e.g. having visited Nutrition before Progress), which
  // is exactly the inconsistency the toggle's removal was supposed to
  // eliminate. Progress is one of the app's fixed bottom-nav destinations
  // now and must show the same real content every time, regardless of
  // `currentMode`.
  it('shows the real section tabs and content the same way regardless of currentMode -- no mode-dependent placeholder', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    renderScreen('nutrition');
    await screen.findByTestId('progress-overview-scroll');

    expect(screen.queryByTestId('progress-nutrition-coming-soon')).toBeNull();
    for (const section of ['Overview', 'TopSets', 'Strength', 'AllTime']) {
      expect(screen.getByTestId(`progress-tabs-${section}`)).toBeTruthy();
    }
  });

  it('lists exactly four sections (Overview, Top Sets, Strength, All Time), defaulting to Overview', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    renderScreen();
    await screen.findByTestId('progress-tabs');

    for (const section of ['Overview', 'TopSets', 'Strength', 'AllTime']) {
      expect(screen.getByTestId(`progress-tabs-${section}`)).toBeTruthy();
    }
    expect(screen.getByText('All Time')).toBeTruthy();
    for (const removed of ['PRs', 'Exercises', 'OneRepMax']) {
      expect(screen.queryByTestId(`progress-tabs-${removed}`)).toBeNull();
    }
    expect(await screen.findByTestId('progress-overview-scroll')).toBeTruthy();
  });

  it('shows the All Time section when its tab is selected', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    renderScreen();
    await screen.findByTestId('progress-overview-scroll');

    goToSection('AllTime');

    expect(await screen.findByTestId('progress-all-time-scroll')).toBeTruthy();
  });

  it('switches sections without losing the tab bar, and never re-fetches', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    renderScreen();
    await screen.findByTestId('progress-overview-scroll');
    // The navigation mock's addListener fires its callback once immediately
    // on registration (simulating the initial focus) on top of the effect's
    // own direct call -- this is the real baseline for one mount, not a bug.
    const callsAfterMount = mockFetchAllExerciseHistory.mock.calls.length;

    goToSection('Strength');
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

    renderScreen();

    expect(await screen.findByTestId('progress-overview-error')).toHaveTextContent('network down');
    expect(screen.getByTestId('progress-tabs')).toBeTruthy();
  });

  it('shows each section’s distinctive content when selected', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(meaningfulBenchHistory);
    renderScreen();
    await screen.findByTestId('progress-overview-scroll');

    goToSection('Strength');
    expect(await screen.findByTestId('progress-strength-scroll')).toBeTruthy();

    goToSection('TopSets');
    expect(await screen.findByTestId('progress-topsets-search')).toBeTruthy();
  });

  it('shows real overview stats by default, reusing the same completed-workouts data as Dashboard/Profile', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    mockFetchAllCompletedWorkouts.mockResolvedValue([
      { performedAt: '2026-01-01T00:00:00Z', completedAt: '2026-01-01T01:00:00Z' },
    ]);
    renderScreen();

    expect(await screen.findByTestId('progress-overview-stat-workouts')).toHaveTextContent(/1/);
    expect(screen.getByTestId('progress-overview-stat-exercises')).toHaveTextContent(/1/);
    expect(screen.getByTestId('progress-overview-stat-sets')).toHaveTextContent(/2/);
  });

  it('switches to the Strength tab when "View Details" is pressed on the Overview card', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    renderScreen();
    await screen.findByTestId('progress-overview-scroll');

    fireEvent.press(screen.getByTestId('progress-overview-view-details'));

    // benchHistory's own dates fall outside the default 4-week range, so
    // this only needs to confirm the tab switch itself, not the featured
    // card's data state -- the section title renders either way.
    expect(await screen.findByText('Strength Progress')).toBeTruthy();
  });

  it('switches to the Strength tab when "View All" is pressed on the Recent Milestones card', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    mockFetchAllRepPRs.mockResolvedValue([
      {
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        muscleGroup: 'chest',
        bestWeightKg: 120,
        reps: 5,
        achievedAt: '2026-02-15T12:00:00Z',
        sourceSetId: 'set-1',
      },
    ]);
    renderScreen();
    await screen.findByTestId('progress-overview-scroll');

    fireEvent.press(screen.getByTestId('progress-overview-view-all-milestones'));

    expect(await screen.findByText('Strength Progress')).toBeTruthy();
  });
});

// Regression coverage for a reported bug: returning to this screen briefly
// blanked it with a full-screen spinner before the refreshed data arrived.
// `load()` only sets `loading` true on the very first call now (see
// `hasLoadedOnce`) -- every later focus-triggered call is a silent
// background refresh.
describe('ProgressOverviewScreen background refresh on focus', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it('does not show the full-screen loading indicator on a focus-triggered refresh', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue(benchHistory);
    renderScreen();
    await screen.findByTestId('progress-overview-scroll');

    const refresh = deferred<unknown[]>();
    mockFetchAllExerciseHistory.mockReturnValue(refresh.promise);

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    act(() => {
      focusCallback();
    });

    expect(screen.queryByTestId('progress-overview-loading')).toBeNull();
    expect(screen.getByTestId('progress-overview-scroll')).toBeTruthy();

    await act(async () => {
      refresh.resolve([]);
      await refresh.promise;
    });
  });
});

describe('ProgressOverviewScreen -- one widget for the active section', () => {
  async function ready() {
    renderScreen();
    await screen.findByTestId('progress-screen');
  }

  it('puts the active section in its own widget, on every tab', async () => {
    await ready();
    for (const section of ['Overview', 'Strength', 'TopSets', 'AllTime']) {
      goToSection(section);
      expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(1);
      expect(screen.getByTestId('progress-section-card')).toBeTruthy();
    }
  });

  it('uses the shared header with a named menu button', async () => {
    await ready();

    expect(screen.getByTestId('progress-open-menu').props.accessibilityLabel).toBe('Open menu');
    expect(screen.getByText('Progress')).toBeTruthy();
  });

  it('renders no bare text outside <Text> on any tab', async () => {
    await ready();
    for (const section of ['Overview', 'Strength', 'TopSets', 'AllTime']) {
      goToSection(section);
      expectNoBareText();
    }
  });
});
