import { StyleSheet } from 'react-native';
import { Polyline } from 'react-native-svg';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fetchExerciseSetHistory } from '../workouts/exerciseHistoryQueries';
import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import { ExerciseProgressScreen } from './ExerciseProgressScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../workouts/exerciseHistoryQueries', () => ({
  fetchExerciseSetHistory: jest.fn(),
}));

jest.mock('../workouts/prQueries', () => ({
  fetchRepPRs: jest.fn(),
  fetchOneRepMax: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchExerciseSetHistory = fetchExerciseSetHistory as jest.Mock;
const mockFetchRepPRs = fetchRepPRs as jest.Mock;
const mockFetchOneRepMax = fetchOneRepMax as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };
const route = { params: { exerciseId: 'ex-1', exerciseName: 'Bench Press' } } as never;

const now = new Date('2026-06-01T00:00:00Z');

// Two sessions well inside every time range, plus one from over a year ago
// so range filtering has something to actually exclude.
const twoSessionHistory = [
  { weightKg: 100, reps: 8, performedAt: '2026-05-01T00:00:00Z', workoutExerciseId: 'we1' },
  { weightKg: 110, reps: 8, performedAt: '2026-05-15T00:00:00Z', workoutExerciseId: 'we2' },
  { weightKg: 90, reps: 8, performedAt: '2024-01-01T00:00:00Z', workoutExerciseId: 'we-old' },
];

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(now);
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
  mockFetchExerciseSetHistory.mockReset().mockResolvedValue([]);
  mockFetchRepPRs.mockReset().mockResolvedValue([]);
  mockFetchOneRepMax.mockReset().mockResolvedValue(null);
  mockGoBack.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ExerciseProgressScreen', () => {
  it('shows a loading indicator, then the loaded content', async () => {
    render(<ExerciseProgressScreen navigation={navigation} route={route} />);

    expect(screen.getByTestId('exercise-progress-loading')).toBeTruthy();
    expect(await screen.findByTestId('top-set-chart-empty')).toBeTruthy();
  });

  it('shows an error message when loading fails', async () => {
    mockFetchExerciseSetHistory.mockRejectedValue(new Error('network error'));

    render(<ExerciseProgressScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('exercise-progress-error')).toHaveTextContent('network error');
  });

  it('shows empty states when there is no history at all', async () => {
    render(<ExerciseProgressScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('top-set-chart-empty')).toBeTruthy();
    expect(screen.getByTestId('rep-pr-chart-empty')).toBeTruthy();
    expect(screen.getByTestId('one-rm-chart-empty')).toBeTruthy();
    expect(screen.getByTestId('best-one-rm-empty')).toBeTruthy();
    expect(screen.getByTestId('best-rep-pr-empty')).toBeTruthy();
    expect(screen.getByTestId('session-frequency')).toHaveTextContent('0 sessions in this period');
  });

  it('renders the top-set and rep-PR charts with real data, in the default 3-month range', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);

    render(<ExerciseProgressScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('top-set-chart')).toBeTruthy();
    expect(screen.getByTestId('rep-pr-chart')).toBeTruthy();
    // Both sessions are 8-rep sets -- the auto-selected rep count.
    expect(screen.getByText('8-Rep PR Progression')).toBeTruthy();
    // Default range (3 months) excludes the >1-year-old session.
    expect(screen.getByTestId('session-frequency')).toHaveTextContent('2 sessions in this period');
  });

  it('excludes out-of-range sessions when a narrower time range is selected', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);

    render(<ExerciseProgressScreen navigation={navigation} route={route} />);
    await screen.findByTestId('top-set-chart');

    fireEvent.press(screen.getByTestId('range-4w'));

    // Only the 2026-05-15 session falls inside the last 4 weeks from 2026-06-01.
    expect(await screen.findByTestId('session-frequency')).toHaveTextContent(
      '1 session in this period',
    );
  });

  it('includes the old session once "All Time" is selected', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);

    render(<ExerciseProgressScreen navigation={navigation} route={route} />);
    await screen.findByTestId('top-set-chart');

    fireEvent.press(screen.getByTestId('range-all'));

    expect(await screen.findByTestId('session-frequency')).toHaveTextContent(
      '3 sessions in this period',
    );
  });

  it('shows current best performances from rep_prs/one_rep_maxes, not derived values', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, bestWeightKg: 110, sourceSetId: 'we2', achievedAt: '2026-05-15T00:00:00Z' },
    ]);
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 150,
      sourceSetId: 's1',
      achievedAt: '2026-05-01T00:00:00Z',
    });

    render(<ExerciseProgressScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('best-one-rm-value')).toHaveTextContent(/150kg/);
    expect(screen.getByTestId('best-rep-pr-value')).toHaveTextContent(/110kg/);
  });

  it("converts displayed weights to the user's preferred unit", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'lb',
    });
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 100,
      sourceSetId: 's1',
      achievedAt: '2026-05-01T00:00:00Z',
    });

    render(<ExerciseProgressScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('best-one-rm-value')).toHaveTextContent(/lb/);
  });

  it('goes back when Back is pressed', async () => {
    render(<ExerciseProgressScreen navigation={navigation} route={route} />);
    await screen.findByText('Bench Press');

    fireEvent.press(screen.getByTestId('exercise-progress-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});

describe('ExerciseProgressScreen -- a stack of widgets', () => {
  it('is five widgets: three charts, best performances and consistency', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    render(<ExerciseProgressScreen navigation={navigation} route={route} />);
    await screen.findByTestId('top-set-chart');

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(5);
  });

  it('offers the time range as one segmented control, short labels each read out in full', async () => {
    render(<ExerciseProgressScreen navigation={navigation} route={route} />);

    const threeMonths = await screen.findByTestId('range-3m');
    expect(threeMonths).toHaveTextContent('3M');
    expect(threeMonths.props.accessibilityLabel).toBe('3 Months');
    expect(screen.getByTestId('range-all')).toHaveTextContent('All');
    expect(screen.getByTestId('range-all').props.accessibilityLabel).toBe('All Time');
  });

  it('marks the selected range, defaulting to 3 months, and moves the mark when another is pressed', async () => {
    render(<ExerciseProgressScreen navigation={navigation} route={route} />);

    expect((await screen.findByTestId('range-3m')).props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('range-4w').props.accessibilityState.selected).toBe(false);

    fireEvent.press(screen.getByTestId('range-4w'));

    expect(screen.getByTestId('range-4w').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('range-3m').props.accessibilityState.selected).toBe(false);
    expect(StyleSheet.flatten(screen.getByTestId('range-4w').props.style).backgroundColor).toBe(
      DEFAULT_WORKOUT_THEME.accent,
    );
  });

  it('plots each chart in the Workout accent colour', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    render(<ExerciseProgressScreen navigation={navigation} route={route} />);
    await screen.findByTestId('top-set-chart');

    const lines = screen.UNSAFE_getAllByType(Polyline);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) expect(line.props.stroke).toBe(DEFAULT_WORKOUT_THEME.accent);
  });

  it('shows best performances as plain rows: the label, then the weight', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, bestWeightKg: 110, sourceSetId: 'we2', achievedAt: '2026-05-15T00:00:00Z' },
    ]);
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 150,
      sourceSetId: 's1',
      achievedAt: '2026-05-01T00:00:00Z',
    });
    render(<ExerciseProgressScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('best-one-rm-value')).toHaveTextContent(/^1RM.*150kg$/);
    expect(screen.getByTestId('best-rep-pr-value')).toHaveTextContent(/^8-Rep PR.*110kg$/);
  });

  it('says so, in the same row, when there is no 1RM or rep PR yet -- never an estimate', async () => {
    render(<ExerciseProgressScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('best-one-rm-empty')).toHaveTextContent(/No 1RM recorded yet/);
    expect(screen.getByTestId('best-rep-pr-empty')).toHaveTextContent(/No rep PR recorded yet/);
  });

  it('names the back control for assistive tech', async () => {
    render(<ExerciseProgressScreen navigation={navigation} route={route} />);
    await screen.findByTestId('range-3m');

    expect(screen.getByTestId('exercise-progress-back').props.accessibilityLabel).toBe('Back');
  });

  it('renders no bare text outside <Text>', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 150,
      sourceSetId: 's1',
      achievedAt: '2026-05-01T00:00:00Z',
    });
    render(<ExerciseProgressScreen navigation={navigation} route={route} />);
    await screen.findByTestId('top-set-chart');

    expectNoBareText();
  });
});
