import { fireEvent, render, screen } from '@testing-library/react-native';
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
