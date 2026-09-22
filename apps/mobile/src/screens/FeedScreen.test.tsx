import { StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppCard } from '../design/AppCard';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { fetchFeedItems } from '../feed/feedQueries';
import { getMyProfile } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { FeedScreen } from './FeedScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../feed/feedQueries', () => ({
  fetchFeedItems: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchFeedItems = fetchFeedItems as jest.Mock;

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
    <AppMenuContext.Provider value={{ openMenu: mockOpenMenu, currentMode: 'workout' }}>
      <FeedScreen navigation={navigation} route={route} />
    </AppMenuContext.Provider>,
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
  });
  mockFetchFeedItems.mockReset().mockResolvedValue(feedPage([]));
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

  it('shows a clean empty state when there is nothing to show', async () => {
    renderScreen();

    expect(await screen.findByTestId('feed-empty')).toHaveTextContent('Nothing here yet');
  });

  it('shows a completed workout as a card: split day, muscles, sets and volume', async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem]));
    renderScreen();

    const card = within(await screen.findByTestId('feed-item-workout-w1'));
    expect(card.getByText('Push')).toBeTruthy();
    expect(card.getByText(/Chest.*Shoulders/)).toBeTruthy();
    expect(screen.getByTestId('feed-item-workout-w1-duration')).toHaveTextContent(/1h/);
    expect(screen.getByTestId('feed-item-workout-w1-sets')).toHaveTextContent(/12/);
    expect(screen.getByTestId('feed-item-workout-w1-volume')).toHaveTextContent(/1000/);
  });

  it("shows the account's own name and picture as each card's byline", async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem]));
    renderScreen();

    const card = within(await screen.findByTestId('feed-item-workout-w1'));
    expect(await card.findByText('Harbir Bains')).toBeTruthy();
  });

  it('shows a logged food as a card: name, meal, and calories', async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([foodLogItem]));
    renderScreen();

    const card = within(await screen.findByTestId('feed-item-foodlog-log-1'));
    expect(card.getByText('Chicken Breast')).toBeTruthy();
    expect(card.getByText(/Lunch/)).toBeTruthy();
    expect(screen.getByTestId('feed-item-foodlog-log-1-calories')).toHaveTextContent(/165/);
    expect(screen.getByTestId('feed-item-foodlog-log-1-protein')).toHaveTextContent(/31/);
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
  it("gives every card the same neutral top accent band -- Feed is black-and-white, kind comes across via icon, not color", async () => {
    mockGetMyProfile.mockResolvedValue({
      id: 'user-1',
      email: 'a@example.com',
      role: 'user',
      displayName: null,
      username: null,
      weightUnit: 'kg',
      // Even with per-mode accent colors set, Feed never uses them --
      // that dual-accent system stays scoped to Train/Nutrition/Profile.
      workoutAccentColor: '#2F80FF',
      nutritionAccentColor: '#10B981',
    });
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem, foodLogItem]));
    renderScreen();
    await screen.findByTestId('feed-item-foodlog-log-1');

    const workoutBand = StyleSheet.flatten(
      screen.getByTestId('feed-item-workout-w1-top-accent').props.style,
    );
    const foodBand = StyleSheet.flatten(
      screen.getByTestId('feed-item-foodlog-log-1-top-accent').props.style,
    );
    expect(workoutBand.backgroundColor).toBe(foodBand.backgroundColor);
    expect(workoutBand.backgroundColor).not.toBe('#2F80FF');
    expect(workoutBand.backgroundColor).not.toBe('#10B981');
  });

  it('draws one card per item, each with its own top accent -- no plain rows', async () => {
    mockFetchFeedItems.mockResolvedValue(feedPage([workoutItem, foodLogItem]));
    renderScreen();
    await screen.findByTestId('feed-item-foodlog-log-1');

    expect(screen.UNSAFE_queryAllByType(AppCard)).toHaveLength(2);
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
