import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fetchExerciseSetHistory } from '../workouts/exerciseHistoryQueries';
import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import { ProgressExerciseDetailScreen } from './ProgressExerciseDetailScreen';

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
const navigation: any = {
  goBack: mockGoBack,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = { params: { exerciseId: 'ex-1', exerciseName: 'Bench Press' } } as never;

const twoSessionHistory = [
  { weightKg: 100, reps: 8, performedAt: '2026-01-01T12:00:00Z', workoutExerciseId: 'we1' },
  { weightKg: 110, reps: 8, performedAt: '2026-02-01T12:00:00Z', workoutExerciseId: 'we2' },
];

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-03-01T00:00:00Z'));
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
  mockFetchExerciseSetHistory.mockReset().mockResolvedValue([]);
  mockFetchRepPRs.mockReset().mockResolvedValue([]);
  mockFetchOneRepMax.mockReset().mockResolvedValue(null);
  mockGoBack.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('ProgressExerciseDetailScreen', () => {
  it('shows the exercise name and an empty state with no history', async () => {
    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />);

    expect(await screen.findByText('Bench Press')).toBeTruthy();
    expect(await screen.findByTestId('progress-exercise-detail-empty')).toHaveTextContent(
      'Complete a workout to start tracking this exercise.',
    );
  });

  it('shows the current top set and lifetime improvement', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);

    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('progress-exercise-detail-current')).toHaveTextContent(
      '110kg × 8',
    );
    expect(screen.getByTestId('progress-exercise-detail-delta')).toHaveTextContent(
      '+10kg since first recorded',
    );
  });

  it('renders a chart point for each session and shows its detail on tap', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);

    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />);
    await screen.findByTestId('progress-exercise-detail-chart');

    fireEvent(screen.getByTestId('progress-exercise-detail-chart'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 280, height: 160 } },
    });
    fireEvent.press(screen.getByTestId('progress-exercise-detail-chart-point-1'));

    const detail = await screen.findByTestId('progress-exercise-detail-point-detail');
    expect(detail).toHaveTextContent(/110kg × 8/);
    expect(within(detail).getByText(/100kg × 8/)).toBeTruthy();
  });

  it('dismisses the point detail', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);

    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />);
    await screen.findByTestId('progress-exercise-detail-chart');
    fireEvent(screen.getByTestId('progress-exercise-detail-chart'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 280, height: 160 } },
    });
    fireEvent.press(screen.getByTestId('progress-exercise-detail-chart-point-1'));
    await screen.findByTestId('progress-exercise-detail-point-detail');

    fireEvent.press(screen.getByTestId('progress-exercise-detail-point-detail-dismiss'));

    expect(screen.queryByTestId('progress-exercise-detail-point-detail')).toBeNull();
  });

  it('shows the true 1RM and rep PR count when present', async () => {
    mockFetchExerciseSetHistory.mockResolvedValue(twoSessionHistory);
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 140,
      sourceSetId: 'set-1',
      achievedAt: '2026-02-01T12:00:00Z',
    });
    mockFetchRepPRs.mockResolvedValue([
      { reps: 8, bestWeightKg: 110, sourceSetId: 'set-2', achievedAt: '2026-02-01T12:00:00Z' },
    ]);

    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('progress-exercise-detail-metric-1rm')).toHaveTextContent(
      /140/,
    );
    expect(screen.getByTestId('progress-exercise-detail-metric-prs')).toHaveTextContent(/1/);
  });

  it('goes back when the back button is pressed', async () => {
    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />);
    await screen.findByTestId('progress-exercise-detail-back');

    fireEvent.press(screen.getByTestId('progress-exercise-detail-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows a load error without crashing', async () => {
    mockFetchExerciseSetHistory.mockRejectedValue(new Error('network down'));

    render(<ProgressExerciseDetailScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('progress-exercise-detail-error')).toHaveTextContent(
      'network down',
    );
  });
});
