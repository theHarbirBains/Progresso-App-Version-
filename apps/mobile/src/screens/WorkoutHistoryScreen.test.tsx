import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Feather } from '@expo/vector-icons';
import { AppCard } from '../design/AppCard';
import { PrimaryButton } from '../design/Button';
import { fonts } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { ProfileProvider } from '../profile/ProfileProvider';
import { addMonths, MONTH_LABELS, toLocalDateKey } from '../workouts/calendarGrid';
import { enrichWorkoutSummaries } from '../workouts/workoutHistoryEnrichment';
import {
  fetchActiveWorkout,
  fetchWorkoutHistory,
  fetchWorkoutsForMonth,
} from '../workouts/workoutQueries';
import { WorkoutHistoryScreen } from './WorkoutHistoryScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  fetchActiveWorkout: jest.fn(),
  fetchWorkoutHistory: jest.fn(),
  fetchWorkoutsForMonth: jest.fn(),
}));

jest.mock('../workouts/workoutHistoryEnrichment', () => ({
  enrichWorkoutSummaries: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchActiveWorkout = fetchActiveWorkout as jest.Mock;
const mockFetchWorkoutHistory = fetchWorkoutHistory as jest.Mock;
const mockFetchWorkoutsForMonth = fetchWorkoutsForMonth as jest.Mock;
const mockEnrichWorkoutSummaries = enrichWorkoutSummaries as jest.Mock;

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};

const mockOpenMenu = jest.fn();

// WorkoutHistoryScreen now opens the app-level side menu (via
// AppMenuContext) from its own header, same as Dashboard -- this stands in
// for that root-level provider.
function renderScreen(currentMode: 'workout' | 'nutrition' = 'workout') {
  return render(
    <ProfileProvider>
      <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode }}>
        <WorkoutHistoryScreen navigation={navigation} route={{} as never} />
      </AppMenuContext.Provider>
    </ProfileProvider>,
  );
}

// Never hardcode "today" -- every fixture/assertion is built relative to
// whenever the suite actually runs, so this never rots into a flaky
// date-dependent test.
const today = new Date();
const CURRENT_YEAR = today.getFullYear();
const CURRENT_MONTH = today.getMonth() + 1;
const CURRENT_MONTH_LABEL = `${MONTH_LABELS[CURRENT_MONTH - 1]} ${CURRENT_YEAR}`;
// Two days comfortably inside the current month regardless of today's actual date.
const fixtureDate = new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 5);
const FIXTURE_DATE_KEY = toLocalDateKey(fixtureDate);
const OTHER_DAY_KEY = toLocalDateKey(new Date(CURRENT_YEAR, CURRENT_MONTH - 1, 20));

function enrichedFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'w1',
    name: 'Push Day',
    performedAt: fixtureDate.toISOString(),
    completedAt: new Date(fixtureDate.getTime() + 58 * 60000).toISOString(),
    workoutSplitDayId: 'day-push',
    splitDayName: 'Push',
    muscleGroups: ['chest', 'shoulders', 'triceps'],
    completedSetCount: 18,
    durationMinutes: 58,
    ...overrides,
  };
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchActiveWorkout.mockReset().mockResolvedValue(null);
  mockFetchWorkoutsForMonth.mockReset().mockResolvedValue([]);
  mockFetchWorkoutHistory.mockReset().mockResolvedValue({ rows: [], hasMore: false });
  mockEnrichWorkoutSummaries.mockReset().mockImplementation(async (rows: unknown[]) => rows);
  mockNavigate.mockClear();
  mockOpenMenu.mockClear();
});

// FlatList/VirtualizedList schedules a deferred internal setState (cell
// render bookkeeping) via a real setTimeout that can otherwise fire after a
// test ends -- same pattern as the rest of this codebase's FlatList tests.
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  });
}

describe('WorkoutHistoryScreen', () => {
  it('shows the current month by default', async () => {
    renderScreen();

    expect(await screen.findByText(CURRENT_MONTH_LABEL)).toBeTruthy();
    expect(mockFetchWorkoutsForMonth).toHaveBeenCalledWith('user-1', CURRENT_YEAR, CURRENT_MONTH);
    await settle();
  });

  it('opens the app-level side menu when the header button is pressed', async () => {
    renderScreen();
    await screen.findByText(CURRENT_MONTH_LABEL);

    fireEvent.press(screen.getByTestId('workout-history-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith();
    await settle();
  });

  // The hamburger and the page title used to be stacked in separate rows
  // (menu button above "Workouts"); the shared AppHeader now puts them on
  // one row, with the title centered.
  it('renders the hamburger and the "Workouts" title on the shared AppHeader row', async () => {
    renderScreen();
    await screen.findByText(CURRENT_MONTH_LABEL);

    const header = screen.getByTestId('workout-history-header');
    expect(within(header).getByTestId('workout-history-open-menu')).toBeTruthy();
    expect(within(header).getByText('Workouts')).toBeTruthy();
    await settle();
  });

  it("navigates to the previous/next month and reloads that month's data", async () => {
    renderScreen();
    await screen.findByText(CURRENT_MONTH_LABEL);
    mockFetchWorkoutsForMonth.mockClear();

    fireEvent.press(screen.getByTestId('calendar-prev-month'));

    const prev = addMonths(CURRENT_YEAR, CURRENT_MONTH, -1);
    expect(await screen.findByText(`${MONTH_LABELS[prev.month - 1]} ${prev.year}`)).toBeTruthy();
    expect(mockFetchWorkoutsForMonth).toHaveBeenCalledWith('user-1', prev.year, prev.month);
    await settle();
  });

  it('marks real completed-workout dates on the calendar', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);

    renderScreen();
    await screen.findByTestId('workout-calendar');

    const dot = await screen.findByTestId(`workout-calendar-dot-${FIXTURE_DATE_KEY}`);
    expect(dot.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ opacity: 1 })]),
    );
    await settle();
  });

  it('shows the workouts for a selected date', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);

    renderScreen();
    await screen.findByTestId('workout-calendar');

    fireEvent.press(screen.getByTestId(`calendar-day-${FIXTURE_DATE_KEY}`));

    expect(await screen.findByTestId('workout-item-w1')).toHaveTextContent(/Push/);
    await settle();
  });

  it('shows a clean empty state for a selected date with no workout', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);

    renderScreen();
    await screen.findByTestId('workout-calendar');

    fireEvent.press(screen.getByTestId(`calendar-day-${OTHER_DAY_KEY}`));

    expect(await screen.findByTestId('selected-day-empty')).toHaveTextContent(
      'No workout on this day',
    );
    await settle();
  });

  it('deselects a date when it is tapped again', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);

    renderScreen();
    await screen.findByTestId('workout-calendar');

    fireEvent.press(screen.getByTestId(`calendar-day-${FIXTURE_DATE_KEY}`));
    expect(await screen.findByTestId('selected-day-section')).toBeTruthy();

    fireEvent.press(screen.getByTestId(`calendar-day-${FIXTURE_DATE_KEY}`));
    expect(screen.queryByTestId('selected-day-section')).toBeNull();
    await settle();
  });

  it('computes the monthly Total Workouts / Total Time / Total Sets summary from real data', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([
      enrichedFixture({ id: 'w1', durationMinutes: 58, completedSetCount: 18 }),
      enrichedFixture({ id: 'w2', durationMinutes: 62, completedSetCount: 15 }),
    ]);

    renderScreen();

    expect(await screen.findByTestId('workout-month-total')).toHaveTextContent(/^2/);
    expect(screen.getByTestId('workout-month-time')).toHaveTextContent(/^2h 0m/);
    expect(screen.getByTestId('workout-month-sets')).toHaveTextContent(/^33/);
    await settle();
  });

  it('never shows a Total Volume/weight metric anywhere on this screen', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);
    mockFetchWorkoutHistory.mockResolvedValue({ rows: [enrichedFixture({})], hasMore: false });

    renderScreen();
    await screen.findByTestId('workout-item-w1');

    expect(screen.queryByText(/volume/i)).toBeNull();
    expect(screen.queryByText(/kg\b/i)).toBeNull();
    await settle();
  });

  it('renders Recent Workouts with muscle groups from the split day and a set count, not weight', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({
      rows: [enrichedFixture({})],
      hasMore: false,
    });

    renderScreen();

    const card = await screen.findByTestId('workout-item-w1');
    expect(card).toHaveTextContent(/Push/);
    expect(card).toHaveTextContent(/Chest/);
    expect(card).toHaveTextContent(/18 sets/);
    await settle();
  });

  it("falls back to the workout's own name when no split day is tagged", async () => {
    mockFetchWorkoutHistory.mockResolvedValue({
      rows: [enrichedFixture({ splitDayName: null, muscleGroups: [], workoutSplitDayId: null })],
      hasMore: false,
    });

    renderScreen();

    expect(await screen.findByTestId('workout-item-w1')).toHaveTextContent(/Push Day/);
    await settle();
  });

  it('navigates to WorkoutDetail when a recent workout card is pressed', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({ rows: [enrichedFixture({})], hasMore: false });

    renderScreen();
    await screen.findByTestId('workout-item-w1');

    fireEvent.press(screen.getByTestId('workout-item-w1'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w1' });
    await settle();
  });

  it('shows a resume banner instead of "start new" when a draft is active', async () => {
    mockFetchActiveWorkout.mockResolvedValue({
      id: 'draft-1',
      name: 'Leg Day',
      performedAt: fixtureDate.toISOString(),
      completedAt: null,
      workoutSplitDayId: null,
    });

    renderScreen();

    expect(await screen.findByTestId('resume-active-workout')).toHaveTextContent(/Leg Day/);
    expect(screen.queryByTestId('start-new-workout')).toBeNull();

    fireEvent.press(screen.getByTestId('resume-active-workout'));
    expect(mockNavigate).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'draft-1' });
    await settle();
  });

  it('navigates to NewWorkout when "Start New Workout" is pressed', async () => {
    renderScreen();
    await screen.findByTestId('start-new-workout');

    fireEvent.press(screen.getByTestId('start-new-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');
    await settle();
  });

  it('loads more recent history on press and appends results', async () => {
    mockFetchWorkoutHistory
      .mockResolvedValueOnce({ rows: [enrichedFixture({ id: 'w1' })], hasMore: true })
      .mockResolvedValueOnce({
        rows: [enrichedFixture({ id: 'w2', name: 'Pull Day', splitDayName: 'Pull' })],
        hasMore: false,
      });

    renderScreen();
    await screen.findByTestId('workout-item-w1');
    expect(screen.getByTestId('workout-history-load-more')).toBeTruthy();

    fireEvent.press(screen.getByTestId('workout-history-load-more'));

    expect(await screen.findByTestId('workout-item-w2')).toBeTruthy();
    expect(mockFetchWorkoutHistory).toHaveBeenLastCalledWith('user-1', 1, 20);
    await settle();
  });

  it('shows an error message with retry when loading the recent list fails', async () => {
    mockFetchWorkoutHistory.mockRejectedValue(new Error('network error'));

    renderScreen();

    expect(await screen.findByTestId('workout-history-error')).toHaveTextContent('network error');
    await settle();
  });

  it('shows a polished empty state when there is no workout history at all', async () => {
    renderScreen();

    await waitFor(() => expect(screen.queryByTestId('workout-history-loading')).toBeNull());
    expect(screen.getByTestId('workout-history-empty')).toBeTruthy();
    await settle();
  });

  // The bottom nav and its quick-action "+" menu are no longer owned by
  // this screen -- both are mounted once at the app-shell level (App.tsx)
  // so they persist across every screen instead of disappearing on
  // navigation; see App.test.tsx's "Persistent bottom navigation" coverage.
  it('does not render its own bottom nav', async () => {
    renderScreen();
    await screen.findByTestId('workout-calendar');

    expect(screen.queryByTestId('bottom-nav-bar')).toBeNull();
    await settle();
  });
});

// Regression coverage for a reported bug: returning to this screen briefly
// blanked the calendar/recent list with full-screen spinners before the
// refreshed data arrived. loadMonth/loadRecent only set their own loading
// flag true on the very first focus now (see `hasLoadedOnce`) -- every
// later focus-triggered call is a silent background refresh. Explicit
// month navigation (Prev/Next) is untouched and still shows its own loading
// state, since that's a genuinely new fetch the user just asked for.
describe('WorkoutHistoryScreen background refresh on focus', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it('does not show the month/recent loading indicators on a focus-triggered refresh', async () => {
    renderScreen();
    await screen.findByTestId('workout-calendar');
    await settle();

    const monthRefresh = deferred<unknown[]>();
    const recentRefresh = deferred<{ rows: unknown[]; hasMore: boolean }>();
    mockFetchWorkoutsForMonth.mockReturnValue(monthRefresh.promise);
    mockFetchWorkoutHistory.mockReturnValue(recentRefresh.promise);

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    act(() => {
      focusCallback();
    });

    expect(screen.queryByTestId('workout-month-loading')).toBeNull();
    expect(screen.queryByTestId('workout-history-loading')).toBeNull();
    expect(screen.getByTestId('workout-calendar')).toBeTruthy();

    await act(async () => {
      monthRefresh.resolve([]);
      recentRefresh.resolve({ rows: [], hasMore: false });
      await Promise.all([monthRefresh.promise, recentRefresh.promise]);
    });
    await settle();
  });

  it('still shows the month loading indicator when the user explicitly switches months', async () => {
    renderScreen();
    await screen.findByTestId('workout-calendar');
    await settle();

    const monthRefresh = deferred<unknown[]>();
    mockFetchWorkoutsForMonth.mockReturnValue(monthRefresh.promise);

    fireEvent.press(screen.getByTestId('calendar-prev-month'));

    expect(screen.getByTestId('workout-month-loading')).toBeTruthy();

    await act(async () => {
      monthRefresh.resolve([]);
      await monthRefresh.promise;
    });
    await settle();
  });
});

describe('WorkoutHistoryScreen -- a stack of widgets', () => {
  const twoWorkouts = [
    enrichedFixture({ id: 'w1' }),
    enrichedFixture({ id: 'w2', splitDayName: 'Pull', name: 'Pull Day', completedSetCount: 12 }),
  ];

  it('is a stack of widgets: action, calendar and recent workouts', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({ rows: twoWorkouts, hasMore: false });
    renderScreen();
    await screen.findByTestId('workout-item-w1');

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(3);
    expect(screen.getByTestId('workout-history-start')).toBeTruthy();
    expect(screen.getByTestId('workout-history-calendar-card')).toBeTruthy();
    expect(
      within(screen.getByTestId('workout-history-recent')).getByTestId('workout-item-w1'),
    ).toBeTruthy();
    await settle();
  });

  it('adds a widget for the selected day, and swaps the start widget for the resume one', async () => {
    mockFetchActiveWorkout.mockResolvedValue({ id: 'active-1', name: 'Leg Day' });
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);
    mockFetchWorkoutHistory.mockResolvedValue({ rows: twoWorkouts, hasMore: false });
    renderScreen();
    await screen.findByTestId('active-workout-banner');
    fireEvent.press(await screen.findByTestId(`calendar-day-${FIXTURE_DATE_KEY}`));
    await screen.findByTestId('selected-day-section');

    // resume + calendar + selected day + recent
    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(4);
    expect(screen.queryByTestId('workout-history-start')).toBeNull();
    await settle();
  });

  it('shows a workout as one row: split day, muscles, then date · duration · sets', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({ rows: twoWorkouts, hasMore: false });
    renderScreen();

    const row = await screen.findByTestId('workout-item-w1');
    expect(row.props.accessibilityRole).toBe('button');
    expect(row).toHaveTextContent(/Push/);
    expect(row).toHaveTextContent(/Chest • Shoulders • Triceps/);
    expect(row).toHaveTextContent(/58 min · 18 sets/);
    await settle();
  });

  it('separates workout rows with a hairline, none above the first, and no accent stripe', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({ rows: twoWorkouts, hasMore: false });
    renderScreen();

    const first = StyleSheet.flatten((await screen.findByTestId('workout-item-w1')).props.style);
    const second = StyleSheet.flatten(screen.getByTestId('workout-item-w2').props.style);
    expect(first.borderTopWidth).toBeUndefined();
    expect(second.borderTopWidth).toBe(StyleSheet.hairlineWidth);
    expect(first.borderLeftWidth).toBeUndefined();
    await settle();
  });

  it('has exactly one filled button: Start New Workout, or Resume when one is in progress', async () => {
    renderScreen();
    await screen.findByTestId('start-new-workout');
    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    await settle();
  });

  it('shows the resume prompt as a line above the one Resume button, in its own widget', async () => {
    mockFetchActiveWorkout.mockResolvedValue({ id: 'active-1', name: 'Leg Day' });
    renderScreen();

    const banner = await screen.findByTestId('active-workout-banner');
    expect(within(banner).getByText('You have a workout in progress')).toBeTruthy();
    expect(screen.queryByTestId('start-new-workout')).toBeNull();
    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    await settle();
  });

  it('shows the month summary as three raised stat blocks with neutral mono figures, without icon circles', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);
    renderScreen();

    const total = await screen.findByTestId('workout-month-total');
    const style = StyleSheet.flatten(within(total).getByText('1').props.style);
    expect(style.fontFamily).toBe(fonts.mono);
    expect(screen.UNSAFE_queryAllByType(Feather).map((i) => i.props.name)).not.toContain(
      'check-square',
    );
    const summary = within(screen.getByTestId('workout-month-summary'));
    expect(summary.getByText('Workouts')).toBeTruthy();
    expect(summary.getByText('Total Time')).toBeTruthy();
    expect(summary.getByText('Total Sets')).toBeTruthy();
    await settle();
  });

  it('names the calendar month arrows and days for assistive tech', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);
    renderScreen();
    await screen.findByTestId('workout-calendar');

    expect(screen.getByTestId('calendar-prev-month').props.accessibilityLabel).toBe(
      'Previous month',
    );
    expect(screen.getByTestId(`calendar-day-${FIXTURE_DATE_KEY}`).props.accessibilityLabel).toMatch(
      /workout completed$/,
    );
    await settle();
  });

  it('shows Load More as a text action that reports busy while loading', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({ rows: twoWorkouts, hasMore: true });
    renderScreen();
    const more = await screen.findByTestId('workout-history-load-more');

    expect(more).toHaveTextContent('Load More');
    expect(StyleSheet.flatten(more.props.style).borderWidth).toBeUndefined();
    expect(StyleSheet.flatten(more.props.style).minHeight).toBeGreaterThanOrEqual(44);
    await settle();
  });

  it('renders no bare text outside <Text>', async () => {
    mockFetchActiveWorkout.mockResolvedValue({ id: 'active-1', name: 'Leg Day' });
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);
    mockFetchWorkoutHistory.mockResolvedValue({ rows: twoWorkouts, hasMore: true });
    renderScreen();
    await screen.findByTestId('workout-item-w1');
    fireEvent.press(screen.getByTestId(`calendar-day-${FIXTURE_DATE_KEY}`));
    await screen.findByTestId('selected-day-section');

    expectNoBareText();
    await settle();
  });
});
