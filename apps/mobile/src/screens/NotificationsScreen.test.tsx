import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import {
  listNotifications,
  markNotificationsRead,
  respondToFollowRequest,
  sendFollowRequest,
  type AppNotification,
} from '../lib/api';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { ProfileProvider } from '../profile/ProfileProvider';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { NotificationsScreen } from './NotificationsScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  listNotifications: jest.fn(),
  markNotificationsRead: jest.fn(),
  respondToFollowRequest: jest.fn(),
  sendFollowRequest: jest.fn(),
}));

jest.mock('../lib/pushNotifications', () => ({
  setAppBadge: jest.fn(async () => undefined),
}));

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

jest.mock('../nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
}));

jest.mock('../workouts/allExerciseHistoryQueries', () => ({
  fetchAllExerciseHistory: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockListNotifications = listNotifications as jest.Mock;
const mockMarkRead = markNotificationsRead as jest.Mock;
const mockRespondToFollowRequest = respondToFollowRequest as jest.Mock;
const mockFetchNutritionGoals = fetchNutritionGoals as jest.Mock;
const mockFetchAllExerciseHistory = fetchAllExerciseHistory as jest.Mock;

const baseProfile = {
  id: 'user-1',
  email: 'a@example.com',
  role: 'user',
  displayName: null,
  username: null,
  weightUnit: 'kg' as const,
  workoutAccentColor: null,
  nutritionAccentColor: null,
  activeWorkoutSplitId: 'split-1',
};

const setGoals = { calories: 2400, proteinG: 180, carbsG: 250, fatG: 70 };
const noGoals = { calories: null, proteinG: null, carbsG: null, fatG: null };

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

/** A notification as the server lists it. */
function note(
  extra: Partial<AppNotification> & Pick<AppNotification, 'id' | 'type'>,
): AppNotification {
  return {
    title: 'New follow request',
    body: 'Jane Doe wants to follow you. Check out their profile!',
    at: '2026-01-01T00:00:00Z',
    read: false,
    actor: { id: 'user-2', username: 'jane', displayName: 'Jane Doe', avatarUrl: null },
    actorCount: 1,
    path: 'notifications',
    followId: null,
    workoutId: null,
    commentId: null,
    groupId: null,
    available: true,
    ...extra,
  };
}

const janeRequest = note({
  id: 'n-request',
  type: 'follow_request',
  followId: 'follow-1',
  followStatus: 'pending',
  followingBack: 'none',
});

const bobAccepted = note({
  id: 'n-accepted',
  type: 'follow_accepted',
  title: 'Follow request accepted',
  body: "Bob Smith accepted your follow request. You're now connected!",
  followId: 'follow-2',
  read: true,
  actor: { id: 'user-3', username: 'bob', displayName: 'Bob Smith', avatarUrl: null },
  path: 'people/user-3',
});

const listed = (notifications: AppNotification[]) => ({
  notifications,
  unread: notifications.filter((n) => !n.read).length,
});

function renderScreen() {
  return render(
    <ProfileProvider>
      <NotificationsScreen navigation={navigation} route={route} />
    </ProfileProvider>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  // Defaults keep both new setup reminders quiet -- an active split and
  // saved goals already -- so existing insight/activity tests, which don't
  // care about either, see the same behavior as before these were added.
  mockFetchMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockListNotifications.mockReset().mockResolvedValue(listed([]));
  mockMarkRead.mockReset().mockResolvedValue({ unread: 0 });
  mockRespondToFollowRequest.mockReset().mockResolvedValue({ success: true });
  mockFetchNutritionGoals.mockReset().mockResolvedValue(setGoals);
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

describe('NotificationsScreen -- setup reminders', () => {
  it('reminds a user with no active split to set one up, and taps through to Choose Workout Split', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: null });
    renderScreen();

    const card = await screen.findByTestId('notifications-insight-no-split');
    expect(card).toHaveTextContent(/Set up a workout split/);

    fireEvent.press(card);
    expect(mockNavigate).toHaveBeenCalledWith('ChooseWorkoutSplit');
  });

  it('reminds a user with no nutrition goals to set them, and taps through to Nutrition Goals', async () => {
    mockFetchNutritionGoals.mockResolvedValue(noGoals);
    renderScreen();

    const card = await screen.findByTestId('notifications-insight-no-nutrition-goals');
    expect(card).toHaveTextContent(/Set your calorie target/);

    fireEvent.press(card);
    expect(mockNavigate).toHaveBeenCalledWith('NutritionGoals');
  });

  it('does not show either reminder once a split is active and goals are saved', async () => {
    renderScreen();

    await screen.findByTestId('notifications-empty');
    expect(screen.queryByTestId('notifications-insight-no-split')).toBeNull();
    expect(screen.queryByTestId('notifications-insight-no-nutrition-goals')).toBeNull();
  });

  it('shows both reminders together for a brand-new user with neither set up', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: null });
    mockFetchNutritionGoals.mockResolvedValue(noGoals);
    renderScreen();

    expect(await screen.findByTestId('notifications-insight-no-split')).toBeTruthy();
    expect(screen.getByTestId('notifications-insight-no-nutrition-goals')).toBeTruthy();
  });
});

describe('NotificationsScreen -- activity', () => {
  it('shows a pending request, unread, in its push’s own words, with Accept/Reject', async () => {
    mockListNotifications.mockResolvedValue(listed([janeRequest]));
    renderScreen();

    const card = await screen.findByTestId('notifications-activity-n-request');
    expect(card).toHaveTextContent(/New follow request/);
    expect(card).toHaveTextContent(/Jane Doe wants to follow you\. Check out their profile!/);
    expect(screen.getByTestId('notifications-activity-n-request-unread')).toBeTruthy();
    expect(screen.getByTestId('notifications-activity-n-request-accept')).toBeTruthy();
    expect(screen.getByTestId('notifications-activity-n-request-reject')).toBeTruthy();
  });

  it('shows a read item with no dot and no buttons', async () => {
    mockListNotifications.mockResolvedValue(listed([bobAccepted]));
    renderScreen();

    const card = await screen.findByTestId('notifications-activity-n-accepted');
    expect(card).toHaveTextContent(/Bob Smith accepted your follow request/);
    expect(screen.queryByTestId('notifications-activity-n-accepted-unread')).toBeNull();
    expect(within(card).queryByText('Accept')).toBeNull();
  });

  it('accepting keeps the request, now to follow back right there', async () => {
    mockListNotifications.mockResolvedValue(listed([janeRequest]));
    (sendFollowRequest as jest.Mock).mockResolvedValue({ status: 'pending' });
    renderScreen();

    const target = await screen.findByTestId('notifications-activity-n-request-accept');
    await act(async () => {
      fireEvent.press(target);
    });
    expect(mockRespondToFollowRequest).toHaveBeenCalledWith('token-123', 'follow-1', 'accept');
    expect(mockMarkRead).toHaveBeenCalledWith('token-123', ['n-request']);

    await act(async () => {
      fireEvent.press(screen.getByTestId('notifications-activity-n-request-follow-back'));
    });
    expect(sendFollowRequest).toHaveBeenCalledWith('token-123', 'user-2');
    expect(screen.getByTestId('notifications-activity-n-request-requested')).toBeTruthy();
  });

  it('a new follower you already follow has no Follow Back', async () => {
    mockListNotifications.mockResolvedValue(
      listed([
        note({ id: 'n-new', type: 'new_follower', followId: 'f', followingBack: 'accepted' }),
      ]),
    );
    renderScreen();
    await screen.findByTestId('notifications-activity-n-new');
    expect(screen.queryByTestId('notifications-activity-n-new-follow-back')).toBeNull();
  });

  it('rejecting removes the item and calls the backend with "reject"', async () => {
    mockListNotifications.mockResolvedValue(listed([janeRequest]));
    renderScreen();

    const target = await screen.findByTestId('notifications-activity-n-request-reject');
    await act(async () => {
      fireEvent.press(target);
    });

    expect(mockRespondToFollowRequest).toHaveBeenCalledWith('token-123', 'follow-1', 'reject');
    expect(screen.queryByTestId('notifications-activity-n-request')).toBeNull();
  });

  it('marks every one read with Mark All as Read, shown only while some are unread', async () => {
    mockListNotifications.mockResolvedValue(listed([janeRequest, bobAccepted]));
    renderScreen();

    const target = await screen.findByTestId('notifications-mark-all-read');
    await act(async () => {
      fireEvent.press(target);
    });
    expect(mockMarkRead).toHaveBeenCalledWith('token-123');
    expect(screen.queryByTestId('notifications-activity-n-request-unread')).toBeNull();
    expect(screen.queryByTestId('notifications-mark-all-read')).toBeNull();
  });

  it('shows an error state with a working retry', async () => {
    mockListNotifications.mockRejectedValueOnce(new Error('network error'));
    renderScreen();

    expect(await screen.findByTestId('notifications-activity-error')).toBeTruthy();
    mockListNotifications.mockResolvedValue(listed([janeRequest]));
    await act(async () => {
      fireEvent.press(screen.getByTestId('notifications-activity-error-retry'));
    });
    expect(await screen.findByTestId('notifications-activity-n-request')).toBeTruthy();
  });

  it('still shows insights when activity fails to load -- one section failing does not block the other', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue([staleSet(15)]);
    mockListNotifications.mockRejectedValue(new Error('network error'));
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
    mockListNotifications.mockResolvedValue(listed([janeRequest, bobAccepted]));
    renderScreen();
    await screen.findByTestId('notifications-insight-chest');
    await screen.findByTestId('notifications-activity-n-accepted');

    expectNoBareText();
  });
});

describe('NotificationsScreen -- opening one', () => {
  const comment = note({
    id: 'n-comment',
    type: 'workout_comment',
    title: 'New workout comment',
    body: 'Bob Smith commented on your workout: "Strong!"',
    workoutId: 'w9',
    path: 'workouts/w9?focusComments=true',
  });
  const like = note({
    id: 'n-like',
    type: 'workout_like',
    title: 'New workout like',
    body: 'Jane Doe and 2 others liked your workout. Keep up the great work!',
    workoutId: 'w9',
    actorCount: 3,
  });

  it('opens a comment at the workout’s comments, a like at the workout, and marks each read', async () => {
    mockListNotifications.mockResolvedValue(listed([comment, like]));
    renderScreen();

    expect(await screen.findByTestId('notifications-activity-n-like')).toHaveTextContent(
      /Jane Doe and 2 others liked your workout/,
    );
    fireEvent.press(screen.getByTestId('notifications-activity-n-comment'));
    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', {
      workoutId: 'w9',
      focusComments: true,
    });
    expect(mockMarkRead).toHaveBeenCalledWith('token-123', ['n-comment']);
    fireEvent.press(screen.getByTestId('notifications-activity-n-like'));
    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', {
      workoutId: 'w9',
      focusComments: false,
    });
  });

  it('opens the profile of someone who asked to follow you', async () => {
    mockListNotifications.mockResolvedValue(listed([janeRequest]));
    renderScreen();

    fireEvent.press(await screen.findByTestId('notifications-activity-n-request'));

    expect(mockNavigate).toHaveBeenCalledWith('PersonProfile', { userId: 'user-2' });
  });

  it('opens Groups for an invitation, to accept or decline it', async () => {
    mockListNotifications.mockResolvedValue(
      listed([
        note({ id: 'n-invite', type: 'workout_invite', groupId: 'g1', inviteStatus: 'invited' }),
      ]),
    );
    renderScreen();
    fireEvent.press(await screen.findByTestId('notifications-activity-n-invite'));
    expect(mockNavigate).toHaveBeenCalledWith('Groups');
  });

  it('says so, and opens nothing, for a deleted workout or an expired invitation', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockListNotifications.mockResolvedValue(
      listed([
        { ...like, available: false },
        note({
          id: 'n-expired',
          type: 'workout_invite',
          groupId: 'g1',
          inviteStatus: 'expired',
          available: false,
        }),
      ]),
    );
    renderScreen();

    fireEvent.press(await screen.findByTestId('notifications-activity-n-like'));
    expect(alert).toHaveBeenLastCalledWith(
      'Not available',
      'This workout has been deleted, or is no longer shared with you.',
    );
    fireEvent.press(screen.getByTestId('notifications-activity-n-expired'));
    expect(alert).toHaveBeenLastCalledWith(
      'Not available',
      'This invitation has expired: the workout has finished.',
    );
    expect(mockNavigate).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
