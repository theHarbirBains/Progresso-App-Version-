import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import { PRHistoryScreen } from './PRHistoryScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../workouts/prQueries', () => ({
  fetchRepPRs: jest.fn(),
  fetchOneRepMax: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchRepPRs = fetchRepPRs as jest.Mock;
const mockFetchOneRepMax = fetchOneRepMax as jest.Mock;

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack };
const route = { params: { exerciseId: 'ex-1', exerciseName: 'Bench Press' } } as never;

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
  mockFetchRepPRs.mockReset().mockResolvedValue([]);
  mockFetchOneRepMax.mockReset().mockResolvedValue(null);
  mockGoBack.mockClear();
});

describe('PRHistoryScreen', () => {
  it('shows the exercise name as the header', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />);

    expect(await screen.findByText('Bench Press')).toBeTruthy();
  });

  it('lists every rep-count PR, heaviest and lightest reps both shown', async () => {
    mockFetchRepPRs.mockResolvedValue([
      { reps: 5, bestWeightKg: 110, sourceSetId: 's5', achievedAt: '2026-01-01T00:00:00Z' },
      { reps: 8, bestWeightKg: 100, sourceSetId: 's8', achievedAt: '2026-01-02T00:00:00Z' },
    ]);

    render(<PRHistoryScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('pr-row-5')).toHaveTextContent(/5 Rep — 110kg/);
    expect(screen.getByTestId('pr-row-8')).toHaveTextContent(/8 Rep — 100kg/);
  });

  it('shows an empty state when there are no rep PRs yet', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('rep-prs-empty')).toBeTruthy();
  });

  it('shows the true 1RM when one has been logged', async () => {
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 225,
      sourceSetId: 's1',
      achievedAt: '2026-01-01T00:00:00Z',
    });

    render(<PRHistoryScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('one-rep-max-value')).toHaveTextContent(/225kg/);
  });

  it('shows an explicit empty state instead of estimating a 1RM', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('one-rep-max-empty')).toHaveTextContent(/No 1RM recorded yet/);
  });

  it("converts PR and 1RM weights to the user's preferred unit", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'lb',
    });
    mockFetchRepPRs.mockResolvedValue([
      { reps: 5, bestWeightKg: 100, sourceSetId: 's5', achievedAt: '2026-01-01T00:00:00Z' },
    ]);
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 100,
      sourceSetId: 's1',
      achievedAt: '2026-01-01T00:00:00Z',
    });

    render(<PRHistoryScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('pr-row-5')).toHaveTextContent(/lb/);
    expect(screen.getByTestId('one-rep-max-value')).toHaveTextContent(/lb/);
  });

  it('shows a loading indicator while fetching', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />);

    expect(screen.getByTestId('pr-history-loading')).toBeTruthy();

    // Let the in-flight load settle inside act() before the test ends, so
    // React doesn't warn about a state update after the test already returned.
    await screen.findByTestId('rep-prs-empty');
  });

  it('shows an error message when loading fails', async () => {
    mockFetchRepPRs.mockRejectedValue(new Error('network error'));

    render(<PRHistoryScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('pr-history-error')).toHaveTextContent('network error');
  });

  it('goes back when Back is pressed', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />);
    await screen.findByText('Bench Press');

    fireEvent.press(screen.getByTestId('pr-history-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });
});
