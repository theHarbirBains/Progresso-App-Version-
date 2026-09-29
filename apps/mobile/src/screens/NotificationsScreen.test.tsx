import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { listFollowNotifications, respondToFollowRequest } from '../lib/api';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { NotificationsScreen } from './NotificationsScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  listFollowNotifications: jest.fn(),
  respondToFollowRequest: jest.fn(),
}));

jest.mock('../workouts/allExerciseHistoryQueries', () => ({
  fetchAllExerciseHistory: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockListFollowNotifications = listFollowNotifications as jest.Mock;
const mockRespondToFollowRequest = respondToFollowRequest as jest.Mock;
const mockFetchAllExerciseHistory = fetchAllExerciseHistory as jest.Mock;

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  goBack: mockGoBack,
  navigate: mockNavigate,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

function staleSet(daysAgo: number, muscleGroup: 'chest' | 'back' = 'chest') {
  const performedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    weightKg: 100,
    reps: 5,
    performedAt,
    workoutExerciseId: 'we1',
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    muscleGroup,
    movementType: 'bilateral' as const,
  };
}

const janeRequest = {
  kind: 'request' as const,
  followId: 'follow-1',
  at: '2026-01-01T00:00:00Z',
  user: { id: 'user-2', username: 'jane', displayName: 'Jane Doe', avatarUrl: null },
};

const bobAccepted = {
  kind: 'accepted' as const,
  followId: 'follow-2',
  at: '2026-01-02T00:00:00Z',
  user: { id: 'user-3', username: 'bob', displayName: 'Bob Smith', avatarUrl: null },
};

function renderScreen() {
  return render(<NotificationsScreen navigation={navigation} route={route} />);
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockListFollowNotifications.mockReset().mockResolvedValue([]);
  mockRespondToFollowRequest.mockReset().mockResolvedValue({ success: true });
  mockFetchAllExerciseHistory.mockReset().mockResolvedValue([]);
  mockGoBack.mockClear();
  mockNavigate.mockClear();
});

describe('NotificationsScreen -- empty state', () => {
  it('shows "you\'re all caught up" when there is nothing in either section', async () => {
    renderScreen();

    expect(await screen.findByTestId('notifications-empty')).toBeTruthy();
  });
});

describe('NotificationsScreen -- insights', () => {
  it('shows a stale muscle group with days-since text, and taps through to New Workout', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue([staleSet(15)]);
    renderScreen();

    const card = await screen.findByTestId('notifications-insight-chest');
    expect(card).toHaveTextContent(/15 days/);
    expect(card).toHaveTextContent(/Chest/);

    fireEvent.press(card);
    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');
  });

  it('does not flag a recently-trained muscle group', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue([staleSet(1)]);
    renderScreen();

    await screen.findByTestId('notifications-empty');
    expect(screen.queryByTestId('notifications-insights-card')).toBeNull();
  });

  it('shows an error state with a working retry', async () => {
    mockFetchAllExerciseHistory.mockRejectedValueOnce(new Error('network error'));
    renderScreen();

    expect(await screen.findByTestId('notifications-insights-error')).toHaveTextContent(
      'network error',
    );

    mockFetchAllExerciseHistory.mockResolvedValue([staleSet(15)]);
    fireEvent.press(screen.getByTestId('notifications-insights-error-retry'));

    expect(await screen.findByTestId('notifications-insight-chest')).toBeTruthy();
  });
});

describe('NotificationsScreen -- activity', () => {
  it('shows a pending request with Accept/Reject', async () => {
    mockListFollowNotifications.mockResolvedValue([janeRequest]);
    renderScreen();

    const row = within(await screen.findByTestId('notifications-activity-request-follow-1'));
    expect(row.getByText(/Jane Doe wants to follow you/)).toBeTruthy();
    expect(screen.getByTestId('notifications-activity-request-follow-1-accept')).toBeTruthy();
    expect(screen.getByTestId('notifications-activity-request-follow-1-reject')).toBeTruthy();
  });

  it('shows a recently-accepted item with no action buttons', async () => {
    mockListFollowNotifications.mockResolvedValue([bobAccepted]);
    renderScreen();

    const row = within(await screen.findByTestId('notifications-activity-accepted-follow-2'));
    expect(row.getByText(/Bob Smith accepted your follow request/)).toBeTruthy();
    expect(screen.queryByTestId('notifications-activity-request-follow-2-accept')).toBeNull();
  });

  it('accepting removes the item and calls the backend with "accept"', async () => {
    mockListFollowNotifications.mockResolvedValue([janeRequest]);
    renderScreen();
    await screen.findByTestId('notifications-activity-request-follow-1');

    fireEvent.press(screen.getByTestId('notifications-activity-request-follow-1-accept'));

    expect(mockRespondToFollowRequest).toHaveBeenCalledWith('token-123', 'follow-1', 'accept');
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('notifications-activity-request-follow-1')).toBeNull();
  });

  it('rejecting removes the item and calls the backend with "reject"', async () => {
    mockListFollowNotifications.mockResolvedValue([janeRequest]);
    renderScreen();
    await screen.findByTestId('notifications-activity-request-follow-1');

    fireEvent.press(screen.getByTestId('notifications-activity-request-follow-1-reject'));

    expect(mockRespondToFollowRequest).toHaveBeenCalledWith('token-123', 'follow-1', 'reject');
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('notifications-activity-request-follow-1')).toBeNull();
  });

  it('shows an error state with a working retry', async () => {
    mockListFollowNotifications.mockRejectedValueOnce(new Error('network error'));
    renderScreen();

    expect(await screen.findByTestId('notifications-activity-error')).toHaveTextContent(
      'network error',
    );

    mockListFollowNotifications.mockResolvedValue([janeRequest]);
    fireEvent.press(screen.getByTestId('notifications-activity-error-retry'));

    expect(await screen.findByTestId('notifications-activity-request-follow-1')).toBeTruthy();
  });

  it('still shows insights when activity fails to load -- one section failing does not block the other', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue([staleSet(15)]);
    mockListFollowNotifications.mockRejectedValue(new Error('network error'));
    renderScreen();

    expect(await screen.findByTestId('notifications-insight-chest')).toBeTruthy();
    expect(screen.getByTestId('notifications-activity-error')).toBeTruthy();
  });
});

describe('NotificationsScreen -- misc', () => {
  it('goes back via the header', async () => {
    renderScreen();
    await screen.findByTestId('notifications-empty');

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalledWith();
  });

  it('renders no bare text outside <Text>', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue([staleSet(15)]);
    mockListFollowNotifications.mockResolvedValue([janeRequest, bobAccepted]);
    renderScreen();
    await screen.findByTestId('notifications-insight-chest');
    await screen.findByTestId('notifications-activity-accepted-follow-2');

    expectNoBareText();
  });
});
