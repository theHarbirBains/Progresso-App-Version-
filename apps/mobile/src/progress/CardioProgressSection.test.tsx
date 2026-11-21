import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { fetchCardioHistory, type CardioHistoryEntry } from '../cardio/cardioQueries';
import { CardioProgressSection } from './CardioProgressSection';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../cardio/cardioQueries', () => ({
  fetchCardioHistory: jest.fn(),
}));

const mockFetch = fetchCardioHistory as jest.Mock;

// Saturday, November 21, 2026.
const now = () => new Date(2026, 10, 21, 10, 0, 0);
const on = (month: number, day: number) => new Date(2026, month, day, 9).toISOString();

let nextId = 0;
function entry(performedAt: string, extra: Partial<CardioHistoryEntry> = {}): CardioHistoryEntry {
  nextId += 1;
  return {
    id: `c${nextId}`,
    workoutId: `w${nextId}`,
    performedAt,
    afterStrength: false,
    createdAt: performedAt,
    activity: 'outdoor_run',
    name: null,
    durationSeconds: 1800,
    distanceM: null,
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
    ...extra,
  };
}

function renderSection(onOpenWorkout = jest.fn()) {
  render(
    <CardioProgressSection
      accentColor="#E8A23C"
      onAccentColor="#000"
      onOpenWorkout={onOpenWorkout}
      now={now}
    />,
  );
  return onOpenWorkout;
}

describe('CardioProgressSection', () => {
  beforeEach(() => mockFetch.mockReset());

  it('says what it would show while there is no cardio', async () => {
    mockFetch.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByTestId('progress-cardio-empty')).toHaveTextContent('No cardio yet');
    expect(mockFetch).toHaveBeenCalledWith('user-1');
  });

  it("totals the last 30 days' sessions, time and distance, and breaks them down by activity", async () => {
    mockFetch.mockResolvedValue([
      entry(on(9, 1), { distanceM: 21_100, durationSeconds: 7200 }),
      entry(on(10, 10), { distanceM: 5000 }),
      entry(on(10, 18), { distanceM: 10_000, durationSeconds: 3600 }),
      entry(on(10, 20), { activity: 'stairmaster', durationSeconds: 1200, floors: 50 }),
    ]);
    renderSection();

    expect(await screen.findByTestId('progress-cardio-sessions')).toHaveTextContent(/^3/);
    expect(screen.getByTestId('progress-cardio-time')).toHaveTextContent(/1h 50m/);
    expect(screen.getByTestId('progress-cardio-distance')).toHaveTextContent(/15 km/);
    expect(screen.getByTestId('progress-cardio-share-outdoor_run')).toHaveTextContent(
      /Outdoor Running.*2 sessions · 15 km.*1h 30m/,
    );
    // Cardio only -- nothing about sets, volume or calories.
    expect(screen.queryByText(/volume|sets\b|cal\b/i)).toBeNull();

    fireEvent.press(screen.getByTestId('progress-cardio-range-all'));
    expect(screen.getByTestId('progress-cardio-sessions')).toHaveTextContent(/^4/);
    expect(screen.getByTestId('progress-cardio-distance')).toHaveTextContent(/36.1 km/);
  });

  it("shows one activity's averages, bests and sessions -- only what it recorded", async () => {
    mockFetch.mockResolvedValue([
      entry(on(10, 10), { distanceM: 5000 }),
      entry(on(10, 18), { distanceM: 10_000, durationSeconds: 3600, workoutId: 'long-run' }),
      entry(on(10, 20), { activity: 'walking', durationSeconds: 1500 }),
    ]);
    const onOpenWorkout = renderSection();
    await screen.findByTestId('progress-cardio-sessions');

    fireEvent.press(screen.getByTestId('progress-cardio-activity-outdoor_run'));

    // 15 km in 90 minutes: 6:00 a km, 10 km/h.
    expect(screen.getByTestId('progress-cardio-avg-rate')).toHaveTextContent(/Avg pace.*6:00 \/km/);
    expect(screen.getByTestId('progress-cardio-avg-speed')).toHaveTextContent(/10 km\/h/);
    expect(screen.getByTestId('progress-cardio-avg-distance')).toHaveTextContent(/7.5 km/);
    expect(screen.queryByTestId('progress-cardio-avg-incline')).toBeNull();
    expect(screen.queryByTestId('progress-cardio-avg-floors')).toBeNull();
    expect(screen.getByTestId('progress-cardio-best-farthest')).toHaveTextContent(/10 km/);
    expect(screen.getByTestId('progress-cardio-best-fastest')).toHaveTextContent(
      /Best pace.*6:00 \/km/,
    );

    // A session opens its workout.
    const sessions = screen.getAllByTestId(/^progress-cardio-session-/);
    expect(sessions).toHaveLength(2);
    fireEvent.press(sessions[0]);
    expect(onOpenWorkout).toHaveBeenCalledWith('long-run');
  });

  it('lists the weeks with bars, by time, distance, sessions or pace', async () => {
    mockFetch.mockResolvedValue([
      entry(on(10, 18), { distanceM: 10_000, durationSeconds: 3600 }),
      entry(on(10, 10), { distanceM: 5000 }),
    ]);
    renderSection();
    await screen.findByTestId('progress-cardio-sessions');
    // Runs alone: no choosing -- the runs, with their own figures.
    expect(screen.queryByTestId('progress-cardio-activity')).toBeNull();
    expect(screen.getByTestId('progress-cardio-avg-rate')).toBeTruthy();

    const current = () => screen.getByTestId('progress-cardio-trend-current');
    expect(current()).toHaveTextContent(/This Week.*1 session · 10 km.*1h 0m/);
    expect(screen.getAllByTestId('progress-cardio-trend')).toHaveLength(7);

    fireEvent.press(screen.getByTestId('progress-cardio-metric-distance'));
    expect(current()).toHaveTextContent(/10 km/);
    fireEvent.press(screen.getByTestId('progress-cardio-metric-rate'));
    expect(current()).toHaveTextContent(/6:00 \/km/);

    fireEvent.press(screen.getByTestId('progress-cardio-period-monthly'));
    expect(current()).toHaveTextContent(/This Month.*2 sessions · 15 km/);
  });

  it("says so when there's none in the range, still showing the trends", async () => {
    mockFetch.mockResolvedValue([entry(on(7, 1), { distanceM: 5000 })]);
    renderSection();
    expect(await screen.findByTestId('progress-cardio-none')).toHaveTextContent(
      'No Outdoor Running in the last 30 days.',
    );
    expect(within(screen.getByTestId('progress-cardio')).getByText('Trends')).toBeTruthy();
  });

  it('says so when the read fails', async () => {
    mockFetch.mockRejectedValue(new Error('offline'));
    renderSection();
    expect(await screen.findByTestId('progress-cardio-error')).toHaveTextContent('offline');
  });
});
