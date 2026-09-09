import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
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
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByText(CURRENT_MONTH_LABEL)).toBeTruthy();
    expect(mockFetchWorkoutsForMonth).toHaveBeenCalledWith('user-1', CURRENT_YEAR, CURRENT_MONTH);
    await settle();
  });

  it("navigates to the previous/next month and reloads that month's data", async () => {
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
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

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('workout-calendar');

    const dot = await screen.findByTestId(`workout-calendar-dot-${FIXTURE_DATE_KEY}`);
    expect(dot.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ opacity: 1 })]),
    );
    await settle();
  });

  it('shows the workouts for a selected date', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('workout-calendar');

    fireEvent.press(screen.getByTestId(`calendar-day-${FIXTURE_DATE_KEY}`));

    expect(await screen.findByTestId('workout-item-w1')).toHaveTextContent(/Push/);
    await settle();
  });

  it('shows a clean empty state for a selected date with no workout', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('workout-calendar');

    fireEvent.press(screen.getByTestId(`calendar-day-${OTHER_DAY_KEY}`));

    expect(await screen.findByTestId('selected-day-empty')).toHaveTextContent(
      'No workout on this day',
    );
    await settle();
  });

  it('deselects a date when it is tapped again', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
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

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('workout-month-total')).toHaveTextContent('2');
    expect(screen.getByTestId('workout-month-time')).toHaveTextContent('2h 0m');
    expect(screen.getByTestId('workout-month-sets')).toHaveTextContent('33');
    await settle();
  });

  it('never shows a Total Volume/weight metric anywhere on this screen', async () => {
    mockFetchWorkoutsForMonth.mockResolvedValue([enrichedFixture({})]);
    mockFetchWorkoutHistory.mockResolvedValue({ rows: [enrichedFixture({})], hasMore: false });

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
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

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);

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

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('workout-item-w1')).toHaveTextContent(/Push Day/);
    await settle();
  });

  it('navigates to WorkoutDetail when a recent workout card is pressed', async () => {
    mockFetchWorkoutHistory.mockResolvedValue({ rows: [enrichedFixture({})], hasMore: false });

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
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

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('resume-active-workout')).toHaveTextContent(/Leg Day/);
    expect(screen.queryByTestId('start-new-workout')).toBeNull();

    fireEvent.press(screen.getByTestId('resume-active-workout'));
    expect(mockNavigate).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'draft-1' });
    await settle();
  });

  it('navigates to NewWorkout when "Start New Workout" is pressed', async () => {
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
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

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('workout-item-w1');
    expect(screen.getByTestId('workout-history-load-more')).toBeTruthy();

    fireEvent.press(screen.getByTestId('workout-history-load-more'));

    expect(await screen.findByTestId('workout-item-w2')).toBeTruthy();
    expect(mockFetchWorkoutHistory).toHaveBeenLastCalledWith('user-1', 1, 20);
    await settle();
  });

  it('shows an error message with retry when loading the recent list fails', async () => {
    mockFetchWorkoutHistory.mockRejectedValue(new Error('network error'));

    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('workout-history-error')).toHaveTextContent('network error');
    await settle();
  });

  it('shows a polished empty state when there is no workout history at all', async () => {
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);

    await waitFor(() => expect(screen.queryByTestId('workout-history-loading')).toBeNull());
    expect(screen.getByTestId('workout-history-empty')).toBeTruthy();
    await settle();
  });

  it('renders the shared bottom bar with Workouts active', async () => {
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('workout-calendar');

    expect(screen.getByTestId('workouts-bottom-bar')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-workouts').props.accessibilityState.selected).toBe(true);
    await settle();
  });

  it('navigates to Social from the bottom bar', async () => {
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('workout-calendar');

    fireEvent.press(screen.getByTestId('bottom-nav-social'));

    expect(mockNavigate).toHaveBeenCalledWith('Social');
    await settle();
  });

  it('navigates to ProgressOverview from the bottom bar', async () => {
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('workout-calendar');

    fireEvent.press(screen.getByTestId('bottom-nav-progress'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressOverview');
    await settle();
  });

  it('opens the quick action menu and navigates to NewWorkout from it', async () => {
    render(<WorkoutHistoryScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('workout-calendar');

    fireEvent.press(screen.getByTestId('bottom-nav-plus'));
    expect(screen.getByTestId('quick-action-log-food')).toBeTruthy();

    fireEvent.press(screen.getByTestId('quick-action-start-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');
    await settle();
  });
});
