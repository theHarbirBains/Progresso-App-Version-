import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Card } from '../design/Card';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { fetchFeedItems } from '../feed/feedQueries';
import { fetchFriendsFeed, getMyProfile, listFollowNotifications } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { ProfileProvider } from '../profile/ProfileProvider';
import { DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { FeedScreen } from './FeedScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  fetchFriendsFeed: jest.fn(),
  listFollowNotifications: jest.fn(),
}));

jest.mock('../feed/feedQueries', () => ({
  fetchFeedItems: jest.fn(),
}));

jest.mock('../nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplitDetail: jest.fn(),
  fetchLastWorkoutSplitDayId: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchFeedItems = fetchFeedItems as jest.Mock;
const mockFetchFriendsFeed = fetchFriendsFeed as jest.Mock;
const mockListFollowNotifications = listFollowNotifications as jest.Mock;
const mockFetchNutritionGoals = fetchNutritionGoals as jest.Mock;
const mockFetchWorkoutSplitDetail = fetchWorkoutSplitDetail as jest.Mock;
const mockFetchLastWorkoutSplitDayId = fetchLastWorkoutSplitDayId as jest.Mock;

function feedPage(items: unknown[], hasMore = false) {
  return { items, hasMore };
}

const mockNavigate = jest.fn();
const mockOpenMenu = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

const workoutItem = {
  kind: 'workout' as const,
  id: 'workout-w1',
  timestamp: '2026-01-01T13:00:00Z',
  workout: {
    id: 'w1',
    name: 'Push Day',
    performedAt: '2026-01-01T12:00:00Z',
    completedAt: '2026-01-01T13:00:00Z',
    workoutSplitDayId: null,
    splitDayName: 'Push',
    muscleGroups: ['chest' as const, 'shoulders' as const],
    completedSetCount: 12,
    totalVolumeKg: 1000,
    durationMinutes: 60,
    exerciseCount: 4,
  },
};

const olderWorkoutItem = {
  kind: 'workout' as const,
  id: 'workout-w0',
  timestamp: '2025-12-01T13:00:00Z',
  workout: {
    id: 'w0',
    name: 'Leg Day',
    performedAt: '2025-12-01T12:00:00Z',
    completedAt: '2025-12-01T13:00:00Z',
    workoutSplitDayId: null,
    splitDayName: 'Legs',
    muscleGroups: ['quadriceps' as const],
    completedSetCount: 10,
    totalVolumeKg: 800,
    durationMinutes: 45,
    exerciseCount: 3,
  },
};

const foodLogItem = {
  kind: 'foodLog' as const,
  id: 'foodLog-log-1',
  timestamp: '2026-01-01T18:00:00Z',
  log: {
    id: 'log-1',
    foodId: 'food-1',
    foodNameSnapshot: 'Chicken Breast',
    servingSize: 100,
    servingUnit: 'g',
    quantity: 1,
    calories: 165,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
    mealType: 'lunch' as const,
    loggedAt: '2026-01-01T18:00:00Z',
    imageUrl: null,
  },
};

// FeedScreen opens the app-level side menu (via AppMenuContext) from its own
// header, same as every other tab-root screen -- this stands in for that
// root-level provider.
function renderScreen() {
  return render(
    <ProfileProvider>
      <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'workout' }}>
        <FeedScreen navigation={navigation} route={route} />
      </AppMenuContext.Provider>
    </ProfileProvider>,
  );
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue({
    id: 'user-1',
    email: 'a@example.com',
    role: 'user',
    displayName: 'Harbir Bains',
    username: null,
    weightUnit: 'kg',
    workoutAccentColor: null,
    nutritionAccentColor: null,
    avatarUrl: null,
    // Both setup reminders satisfied by default, so the bell's badge count
    // in most tests reflects pending follow requests alone -- see the
    // dedicated "notification badge" describe block for the reminder cases.
    activeWorkoutSplitId: 'split-1',
  });
  mockFetchFeedItems.mockReset().mockResolvedValue(feedPage([]));
  mockFetchFriendsFeed.mockReset().mockResolvedValue(feedPage([]));
  mockListFollowNotifications.mockReset().mockResolvedValue([]);
  mockFetchNutritionGoals
    .mockReset()
    .mockResolvedValue({ calories: 2400, proteinG: 180, carbsG: 250, fatG: 70 });
  // No successful default -- the Next Workout widget stays absent unless a
  // test explicitly sets up a split detail, same "quietly nothing" fallback
  // loadNextWorkout's own catch block gives a real fetch failure.
  mockFetchWorkoutSplitDetail.mockReset().mockRejectedValue(new Error('not set up in this test'));
  mockFetchLastWorkoutSplitDayId.mockReset().mockResolvedValue(null);
  mockNavigate.mockClear();
  mockOpenMenu.mockClear();
});

describe('FeedScreen', () => {
  it('shows a loading indicator while fetching', async () => {
    renderScreen();

    expect(screen.getByTestId('feed-loading')).toBeTruthy();
    await screen.findByTestId('feed-empty');
  });

  it('shows an error message, with a working retry, when loading fails', async () => {
    mockFetchFeedItems.mockRejectedValueOnce(new Error('network error'));
    renderScreen();

    expect(await screen.findByTestId('feed-error')).toHaveTextContent('network error');

    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem]));
    fireEvent.press(screen.getByTestId('feed-error-retry'));

    expect(await screen.findByTestId('feed-item-workout-w1')).toBeTruthy();
  });

  it('shows the Get Started actions, with no other empty-state text, when there is nothing to show', async () => {
    renderScreen();

    expect(await screen.findByTestId('feed-empty-actions')).toBeTruthy();
    expect(screen.queryByText(/ready when you are/i)).toBeNull();
  });

  it('fills the empty state with Get Started actions, each navigating to its own screen', async () => {
    renderScreen();
    await screen.findByTestId('feed-empty');

    fireEvent.press(screen.getByTestId('feed-empty-action-start-workout'));
    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');

    fireEvent.press(screen.getByTestId('feed-empty-action-log-food'));
    expect(mockNavigate).toHaveBeenCalledWith('FoodLibrary');

    fireEvent.press(screen.getByTestId('feed-empty-action-find-people'));
    expect(mockNavigate).toHaveBeenCalledWith('FindPeople');
  });

  it('shows a completed workout as a card: split day, muscles, duration, exercises, sets and volume', async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem]));
    renderScreen();

    const card = within(await screen.findByTestId('feed-item-workout-w1'));
    expect(card.getByText('Push')).toBeTruthy();
    expect(card.getByText(/Chest.*Shoulders/)).toBeTruthy();
    expect(screen.getByTestId('feed-item-workout-w1-duration')).toHaveTextContent(/1h/);
    expect(screen.getByTestId('feed-item-workout-w1-exercises')).toHaveTextContent(/4/);
    expect(screen.getByTestId('feed-item-workout-w1-sets')).toHaveTextContent(/12/);
    expect(screen.getByTestId('feed-item-workout-w1-volume')).toHaveTextContent(/1000/);
  });

  it("shows the account's own name and picture as each card's byline", async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem]));
    renderScreen();

    const card = within(await screen.findByTestId('feed-item-workout-w1'));
    expect(await card.findByText('Harbir Bains')).toBeTruthy();
  });

  it('shows a logged food as a card: name, meal, calories, and all three macros', async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([foodLogItem]));
    renderScreen();

    const card = within(await screen.findByTestId('feed-item-foodlog-log-1'));
    expect(card.getByText('Chicken Breast')).toBeTruthy();
    expect(card.getByText(/Lunch/)).toBeTruthy();
    expect(screen.getByTestId('feed-item-foodlog-log-1-calories')).toHaveTextContent(/165/);
    expect(screen.getByTestId('feed-item-foodlog-log-1-protein')).toHaveTextContent(/31/);
    expect(screen.getByTestId('feed-item-foodlog-log-1-carbs')).toHaveTextContent(/0/);
    // fatG is 3.6 in the fixture, rounded for display -> "4g".
    expect(screen.getByTestId('feed-item-foodlog-log-1-fat')).toHaveTextContent(/4/);
  });

  it('navigates to the workout on tap, and to Nutrition on a food log tap', async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem, foodLogItem]));
    renderScreen();
    await screen.findByTestId('feed-item-workout-w1');

    fireEvent.press(screen.getByTestId('feed-item-workout-w1'));
    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w1' });

    fireEvent.press(screen.getByTestId('feed-item-foodlog-log-1'));
    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('navigates to Find People from the header search icon', async () => {
    renderScreen();
    await screen.findByTestId('feed-empty');

    fireEvent.press(screen.getByTestId('feed-find-people'));

    expect(mockNavigate).toHaveBeenCalledWith('FindPeople');
  });

  it('shows no badge on the notifications bell when there are no pending follow requests', async () => {
    renderScreen();
    await screen.findByTestId('feed-empty');

    expect(screen.queryByTestId('feed-notifications-badge')).toBeNull();
  });

  it('badges the notifications bell with the pending request count (ignoring accepted items), and opens Notifications on tap', async () => {
    mockListFollowNotifications.mockResolvedValue([
      {
        kind: 'request',
        followId: 'f1',
        at: '2026-01-01',
        user: { id: 'u2', username: 'a', displayName: null, avatarUrl: null },
      },
      {
        kind: 'request',
        followId: 'f2',
        at: '2026-01-01',
        user: { id: 'u3', username: 'b', displayName: null, avatarUrl: null },
      },
      {
        kind: 'accepted',
        followId: 'f3',
        at: '2026-01-01',
        user: { id: 'u4', username: 'c', displayName: null, avatarUrl: null },
      },
    ]);
    renderScreen();

    expect(await screen.findByTestId('feed-notifications-badge')).toHaveTextContent('2');

    fireEvent.press(screen.getByTestId('feed-notifications'));
    expect(mockNavigate).toHaveBeenCalledWith('Notifications');
  });

  it('badges the bell for a user with no active workout split, even with zero pending requests', async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: 'Harbir Bains',
      username: null,
      weightUnit: 'kg',
      workoutAccentColor: null,
      nutritionAccentColor: null,
      avatarUrl: null,
      activeWorkoutSplitId: null,
    });
    renderScreen();

    expect(await screen.findByTestId('feed-notifications-badge')).toHaveTextContent('1');
  });

  it('badges the bell for a user with no saved nutrition goals', async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    renderScreen();

    expect(await screen.findByTestId('feed-notifications-badge')).toHaveTextContent('1');
  });

  it('adds pending requests and both setup reminders together into one total', async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: 'Harbir Bains',
      username: null,
      weightUnit: 'kg',
      workoutAccentColor: null,
      nutritionAccentColor: null,
      avatarUrl: null,
      activeWorkoutSplitId: null,
    });
    mockFetchNutritionGoals.mockResolvedValue({
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    mockListFollowNotifications.mockResolvedValue([
      {
        kind: 'request',
        followId: 'f1',
        at: '2026-01-01',
        user: { id: 'u2', username: 'a', displayName: null, avatarUrl: null },
      },
    ]);
    renderScreen();

    expect(await screen.findByTestId('feed-notifications-badge')).toHaveTextContent('3');
  });

  it('opens the app-level side menu when the header button is pressed', async () => {
    renderScreen();
    await screen.findByTestId('feed-empty');

    fireEvent.press(screen.getByTestId('feed-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalledWith();
  });

  it('opens a quick-actions sheet from the header "+", offering Start Workout and Log Food', async () => {
    renderScreen();
    await screen.findByTestId('feed-empty');

    expect(screen.queryByTestId('feed-quick-action-start-workout')).toBeNull();
    fireEvent.press(screen.getByTestId('feed-quick-actions'));

    expect(screen.getByTestId('feed-quick-action-start-workout')).toBeTruthy();
    expect(screen.getByTestId('feed-quick-action-log-food')).toBeTruthy();
    // Scan Barcode moved to Nutrition's own actions -- see NutritionTodayScreen.test.tsx.
    expect(screen.queryByTestId('feed-quick-action-scan-barcode')).toBeNull();
  });

  it('starting a workout from the quick-actions sheet navigates to New Workout and closes the sheet', async () => {
    renderScreen();
    await screen.findByTestId('feed-empty');
    fireEvent.press(screen.getByTestId('feed-quick-actions'));

    fireEvent.press(screen.getByTestId('feed-quick-action-start-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');
    expect(screen.queryByTestId('feed-quick-action-start-workout')).toBeNull();
  });

  it('logging food from the quick-actions sheet navigates to Food Library and closes the sheet', async () => {
    renderScreen();
    await screen.findByTestId('feed-empty');
    fireEvent.press(screen.getByTestId('feed-quick-actions'));

    fireEvent.press(screen.getByTestId('feed-quick-action-log-food'));

    expect(mockNavigate).toHaveBeenCalledWith('FoodLibrary');
    expect(screen.queryByTestId('feed-quick-action-log-food')).toBeNull();
  });

  it('reloads on focus without showing the loading indicator again', async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem]));
    renderScreen();
    await screen.findByTestId('feed-item-workout-w1');

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem, foodLogItem]));
    await act(async () => {
      focusCallback();
    });

    expect(screen.queryByTestId('feed-loading')).toBeNull();
    expect(await screen.findByTestId('feed-item-foodlog-log-1')).toBeTruthy();
  });

  it('renders no bare text outside <Text>', async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem, foodLogItem]));
    renderScreen();
    await screen.findByTestId('feed-item-foodlog-log-1');

    expectNoBareText();
  });
});

describe('FeedScreen -- Strava-style activity cards', () => {
  it('never tints a regular card with an accent color -- Feed is black-and-white, kind comes across via icon, not color', async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'kg',
      // Even with per-mode accent colors set, a regular card never uses
      // them -- only the one Next Workout hero does.
      workoutAccentColor: '#2F80FF',
      nutritionAccentColor: '#10B981',
    });
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem, foodLogItem]));
    renderScreen();
    await screen.findByTestId('feed-item-foodlog-log-1');

    const workoutCard = StyleSheet.flatten(screen.getByTestId('feed-item-workout-w1').props.style);
    const foodCard = StyleSheet.flatten(screen.getByTestId('feed-item-foodlog-log-1').props.style);
    expect(workoutCard.backgroundColor).toBe(foodCard.backgroundColor);
    expect(workoutCard.backgroundColor).not.toBe('#2F80FF');
    expect(workoutCard.backgroundColor).not.toBe('#10B981');
  });

  it('draws one flat card per item -- no plain rows', async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem, foodLogItem]));
    renderScreen();
    await screen.findByTestId('feed-item-foodlog-log-1');

    expect(screen.UNSAFE_queryAllByType(Card)).toHaveLength(2);
  });
});

describe('FeedScreen -- merged Friends activity', () => {
  const friendWorkoutItem = {
    kind: 'workout' as const,
    id: 'workout-fw1',
    timestamp: '2026-01-02T13:00:00Z',
    author: { id: 'user-2', username: 'jane', displayName: 'Jane Doe', avatarUrl: null },
    workout: {
      id: 'fw1',
      name: 'Pull Day',
      splitDayName: 'Pull',
      muscleGroups: ['back' as const],
      durationMinutes: 50,
      exerciseCount: 5,
      completedSetCount: 15,
      totalVolumeKg: 1200,
    },
  };

  const friendFoodLogItem = {
    kind: 'foodLog' as const,
    id: 'foodLog-flog-1',
    timestamp: '2026-01-02T18:00:00Z',
    author: { id: 'user-2', username: 'jane', displayName: 'Jane Doe', avatarUrl: null },
    log: {
      id: 'flog-1',
      foodNameSnapshot: 'Oatmeal',
      calories: 300,
      proteinG: 10,
      carbsG: 50,
      fatG: 5,
      mealType: 'breakfast' as const,
      imageUrl: null,
    },
  };

  it("shows your own and friends' activity together in one list, no tab needed", async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem]));
    mockFetchFriendsFeed.mockResolvedValue(feedPage([friendWorkoutItem]));
    renderScreen();

    expect(await screen.findByTestId('feed-item-workout-w1')).toBeTruthy();
    expect(await screen.findByTestId('feed-item-workout-fw1')).toBeTruthy();
    expect(screen.queryByTestId('feed-tab-friends')).toBeNull();
  });

  it('sorts the merged list by recency regardless of source', async () => {
    // friendWorkoutItem (2026-01-02) is newer than workoutItem (2026-01-01).
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem]));
    mockFetchFriendsFeed.mockResolvedValue(feedPage([friendWorkoutItem]));
    renderScreen();
    await screen.findByTestId('feed-item-workout-fw1');

    const cards = screen.UNSAFE_queryAllByType(Card);
    expect(cards[0].props.testID).toBe('feed-item-workout-fw1');
    expect(cards[1].props.testID).toBe('feed-item-workout-w1');
  });

  it("shows a friend's own name as the card byline, not the signed-in account's", async () => {
    mockFetchFriendsFeed.mockResolvedValue(feedPage([friendWorkoutItem]));
    renderScreen();

    const card = within(await screen.findByTestId('feed-item-workout-fw1'));
    expect(await card.findByText('Jane Doe')).toBeTruthy();
  });

  it("does not navigate on tap -- a friend's workout/food log isn't the signed-in user's to open", async () => {
    mockFetchFriendsFeed.mockResolvedValue(feedPage([friendWorkoutItem, friendFoodLogItem]));
    renderScreen();
    await screen.findByTestId('feed-item-foodlog-flog-1');

    fireEvent.press(screen.getByTestId('feed-item-workout-fw1'));
    fireEvent.press(screen.getByTestId('feed-item-foodlog-flog-1'));

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('a friends-feed failure does not block your own activity from showing', async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem]));
    mockFetchFriendsFeed.mockRejectedValue(new Error('friends feed down'));
    renderScreen();

    expect(await screen.findByTestId('feed-item-workout-w1')).toBeTruthy();
    expect(screen.queryByTestId('feed-error')).toBeNull();
  });

  it('shows a blocking error only when there is nothing at all to show', async () => {
    mockFetchFeedItems.mockRejectedValue(new Error('network error'));
    mockFetchFriendsFeed.mockRejectedValue(new Error('friends feed down'));
    renderScreen();

    expect(await screen.findByTestId('feed-error')).toBeTruthy();
  });

  it('paginates both sources together behind one Load More', async () => {
    mockFetchFeedItems.mockResolvedValueOnce(feedPage([workoutItem], false));
    mockFetchFriendsFeed.mockResolvedValueOnce(feedPage([friendWorkoutItem], true));
    renderScreen();
    await screen.findByTestId('feed-item-workout-fw1');
    expect(screen.getByTestId('feed-load-more')).toBeTruthy();

    mockFetchFriendsFeed.mockResolvedValueOnce(feedPage([friendFoodLogItem], false));
    fireEvent.press(screen.getByTestId('feed-load-more'));

    expect(mockFetchFriendsFeed).toHaveBeenLastCalledWith('token-123', 1);
    expect(await screen.findByTestId('feed-item-foodlog-flog-1')).toBeTruthy();
    expect(screen.getByTestId('feed-item-workout-fw1')).toBeTruthy();
    expect(screen.getByTestId('feed-item-workout-w1')).toBeTruthy();
    // Neither source has more left, so the button is gone.
    expect(screen.queryByTestId('feed-load-more')).toBeNull();
  });
});

describe('FeedScreen -- Load More', () => {
  it('shows no Load More button when there is nothing further back', async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem], false));
    renderScreen();

    await screen.findByTestId('feed-item-workout-w1');
    expect(screen.queryByTestId('feed-load-more')).toBeNull();
  });

  it('pages in older workouts, appended after the current ones, and reports busy while loading', async () => {
    mockFetchFeedItems.mockResolvedValueOnce(feedPage([workoutItem], true));
    renderScreen();
    await screen.findByTestId('feed-item-workout-w1');
    expect(screen.getByTestId('feed-load-more')).toHaveTextContent('Load More');

    mockFetchFeedItems.mockResolvedValueOnce(feedPage([olderWorkoutItem], false));
    fireEvent.press(screen.getByTestId('feed-load-more'));

    expect(mockFetchFeedItems).toHaveBeenLastCalledWith('user-1', 1);
    expect(await screen.findByTestId('feed-item-workout-w0')).toBeTruthy();
    // Still shows the first page's item too -- Load More appends, it doesn't replace.
    expect(screen.getByTestId('feed-item-workout-w1')).toBeTruthy();
    // No more pages left, so the button is gone.
    expect(screen.queryByTestId('feed-load-more')).toBeNull();
  });

  it('does not fetch again while a load is already in flight', async () => {
    mockFetchFeedItems.mockResolvedValueOnce(feedPage([workoutItem], true));
    renderScreen();
    await screen.findByTestId('feed-load-more');

    mockFetchFeedItems.mockReturnValueOnce(new Promise(() => undefined));
    fireEvent.press(screen.getByTestId('feed-load-more'));
    fireEvent.press(screen.getByTestId('feed-load-more'));

    expect(mockFetchFeedItems).toHaveBeenCalledTimes(2);
  });
});

const oneDaySplit = {
  id: 'split-1',
  name: 'PPL',
  days: [{ id: 'day-push', name: 'Push', orderIndex: 1, muscleGroups: ['chest' as const] }],
};

describe('FeedScreen -- Next Workout widget', () => {
  it("shows the next day in the active split's rotation, and taps through to Start Workout", async () => {
    mockFetchWorkoutSplitDetail.mockResolvedValue(oneDaySplit);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);
    renderScreen();

    const card = await screen.findByTestId('feed-next-workout');
    expect(card).toHaveTextContent('Push', { exact: false });
    expect(mockFetchWorkoutSplitDetail).toHaveBeenCalledWith('split-1');

    fireEvent.press(card);
    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');
  });

  it('is absent for a user with no active workout split', async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: 'Harbir Bains',
      username: null,
      weightUnit: 'kg',
      workoutAccentColor: null,
      nutritionAccentColor: null,
      avatarUrl: null,
      activeWorkoutSplitId: null,
    });
    renderScreen();
    await screen.findByTestId('feed-empty');

    expect(screen.queryByTestId('feed-next-workout')).toBeNull();
    expect(mockFetchWorkoutSplitDetail).not.toHaveBeenCalled();
  });

  it('is absent when the active split has no days', async () => {
    mockFetchWorkoutSplitDetail.mockResolvedValue({ id: 'split-1', name: 'Empty', days: [] });
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);
    renderScreen();
    await screen.findByTestId('feed-empty');

    expect(screen.queryByTestId('feed-next-workout')).toBeNull();
  });

  it('shows up as soon as the active split loads, without needing a second focus', async () => {
    // Regression guard: activeWorkoutSplitId arrives from ProfileProvider's
    // own async fetch, after Feed's first focus event has already fired.
    mockFetchWorkoutSplitDetail.mockResolvedValue(oneDaySplit);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);
    renderScreen();

    expect(await screen.findByTestId('feed-next-workout')).toBeTruthy();
  });

  it("is the one card filled solid with the mode accent -- the redesign's single bold hero", async () => {
    mockFetchWorkoutSplitDetail.mockResolvedValue(oneDaySplit);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);
    renderScreen();

    const card = await screen.findByTestId('feed-next-workout');
    expect(StyleSheet.flatten(card.props.style).backgroundColor).toBe(DEFAULT_WORKOUT_THEME.accent);
  });
});
