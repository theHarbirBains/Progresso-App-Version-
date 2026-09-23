import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { fonts } from '../design/theme';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
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
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { goBack: mockGoBack, navigate: mockNavigate };
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
  mockNavigate.mockClear();
});

describe('PRHistoryScreen', () => {
  it('shows the exercise name as the header', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(await screen.findByText('Bench Press')).toBeTruthy();
  });

  it('lists every rep-count PR, heaviest and lightest reps both shown', async () => {
    mockFetchRepPRs.mockResolvedValue([
      { reps: 5, bestWeightKg: 110, sourceSetId: 's5', achievedAt: '2026-01-01T00:00:00Z' },
      { reps: 8, bestWeightKg: 100, sourceSetId: 's8', achievedAt: '2026-01-02T00:00:00Z' },
    ]);

    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    const five = await screen.findByTestId('pr-row-5');
    expect(five).toHaveTextContent(/5 Rep/);
    expect(five).toHaveTextContent(/110kg/);
    const eight = screen.getByTestId('pr-row-8');
    expect(eight).toHaveTextContent(/8 Rep/);
    expect(eight).toHaveTextContent(/100kg/);
  });

  it('shows an empty state when there are no rep PRs yet', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(await screen.findByTestId('rep-prs-empty')).toBeTruthy();
  });

  it('shows the true 1RM when one has been logged', async () => {
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 225,
      sourceSetId: 's1',
      achievedAt: '2026-01-01T00:00:00Z',
    });

    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(await screen.findByTestId('one-rep-max-value')).toHaveTextContent(/225kg/);
  });

  it('shows an explicit empty state instead of estimating a 1RM', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

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

    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(await screen.findByTestId('pr-row-5')).toHaveTextContent(/lb/);
    expect(screen.getByTestId('one-rep-max-value')).toHaveTextContent(/lb/);
  });

  it('shows a loading indicator while fetching', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(screen.getByTestId('pr-history-loading')).toBeTruthy();

    // Let the in-flight load settle inside act() before the test ends, so
    // React doesn't warn about a state update after the test already returned.
    await screen.findByTestId('rep-prs-empty');
  });

  it('shows an error message when loading fails', async () => {
    mockFetchRepPRs.mockRejectedValue(new Error('network error'));

    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    expect(await screen.findByTestId('pr-history-error')).toHaveTextContent('network error');
  });

  it('goes back when Back is pressed', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByText('Bench Press');

    fireEvent.press(screen.getByTestId('pr-history-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('navigates to ExerciseProgress when View Trend is pressed', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('view-trend');

    fireEvent.press(screen.getByTestId('view-trend'));

    expect(mockNavigate).toHaveBeenCalledWith('ExerciseProgress', {
      exerciseId: 'ex-1',
      exerciseName: 'Bench Press',
    });
  });
});

describe('PRHistoryScreen -- widgets, one large 1RM readout', () => {
  const twoPRs = [
    { reps: 5, bestWeightKg: 110, sourceSetId: 's5', achievedAt: '2026-01-01T00:00:00Z' },
    { reps: 8, bestWeightKg: 100, sourceSetId: 's8', achievedAt: '2026-01-02T00:00:00Z' },
  ];

  it('is three widgets: View Trend, the 1RM hero and the rep PRs', async () => {
    mockFetchRepPRs.mockResolvedValue(twoPRs);
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('pr-row-5');

    const cards = screen.UNSAFE_queryAllByType(AppCard);
    expect(cards).toHaveLength(3);
    expect(cards.map((c) => Boolean(c.props.hero))).toEqual([false, true, false]);
    expect(within(screen.getByTestId('pr-history-rep-prs')).getByTestId('pr-row-5')).toBeTruthy();
  });

  it('shows the true 1RM as the one large accent-coloured mono readout, with its date beneath', async () => {
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 225,
      sourceSetId: 's1',
      achievedAt: '2026-01-01T00:00:00Z',
    });
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    const value = StyleSheet.flatten((await screen.findByTestId('one-rep-max-value')).props.style);
    expect(value.color).toBe(DEFAULT_WORKOUT_THEME.accent);
    expect(value.fontFamily).toBe(fonts.monoBold);
    expect(value.fontSize).toBe(30);
    expect(screen.getByText(/\d{4}/)).toBeTruthy();
  });

  it('shows each rep PR as a row: rep count and date on the left, the weight on the right', async () => {
    mockFetchRepPRs.mockResolvedValue(twoPRs);
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    const row = await screen.findByTestId('pr-row-5');
    expect(row).toHaveTextContent(/^5 Rep.*110kg$/);
  });

  it('separates rep PR rows with a hairline, none above the first', async () => {
    mockFetchRepPRs.mockResolvedValue(twoPRs);
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    const first = StyleSheet.flatten((await screen.findByTestId('pr-row-5')).props.style);
    const second = StyleSheet.flatten(screen.getByTestId('pr-row-8').props.style);
    expect(first.borderTopWidth).toBeUndefined();
    expect(second.borderTopWidth).toBe(StyleSheet.hairlineWidth);
  });

  it('offers View Trend as a plain, named row -- not a button styled as a card', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });

    const trend = await screen.findByTestId('view-trend');
    expect(trend.props.accessibilityRole).toBe('button');
    expect(trend.props.accessibilityLabel).toMatch(/^View Trend/);
  });

  it('names the back control for assistive tech', async () => {
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('view-trend');

    expect(screen.getByTestId('pr-history-back').props.accessibilityLabel).toBe('Back');
  });

  it('renders no bare text outside <Text>', async () => {
    mockFetchRepPRs.mockResolvedValue(twoPRs);
    mockFetchOneRepMax.mockResolvedValue({
      weightKg: 225,
      sourceSetId: 's1',
      achievedAt: '2026-01-01T00:00:00Z',
    });
    render(<PRHistoryScreen navigation={navigation} route={route} />, { wrapper: ProfileProvider });
    await screen.findByTestId('pr-row-5');

    expectNoBareText();
  });
});
