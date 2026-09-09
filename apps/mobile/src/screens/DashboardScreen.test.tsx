import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { fetchTodaysFoodLogs } from '../nutrition/foodLogQueries';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { fetchActiveWorkout } from '../workouts/workoutQueries';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { DEFAULT_NUTRITION_THEME, DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { DashboardScreen } from './DashboardScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  fetchActiveWorkout: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplitDetail: jest.fn(),
  fetchLastWorkoutSplitDayId: jest.fn(),
}));

jest.mock('../nutrition/foodLogQueries', () => ({
  fetchTodaysFoodLogs: jest.fn(),
}));

jest.mock('../nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchActiveWorkout = fetchActiveWorkout as jest.Mock;
const mockFetchWorkoutSplitDetail = fetchWorkoutSplitDetail as jest.Mock;
const mockFetchLastWorkoutSplitDayId = fetchLastWorkoutSplitDayId as jest.Mock;
const mockFetchTodaysFoodLogs = fetchTodaysFoodLogs as jest.Mock;
const mockFetchNutritionGoals = fetchNutritionGoals as jest.Mock;

const mockNavigate = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};
const route = {} as never;

const mockOpenMenu = jest.fn();

// DashboardScreen now only asks the root-level AppSideMenu to open (via
// AppMenuContext) rather than rendering/owning the drawer itself -- see
// App.tsx, where AppSideMenu is mounted as a sibling of the navigator so it
// can render above the ENTIRE app instead of being clipped inside any one
// screen. This helper stands in for that root-level provider.
function renderDashboard() {
  return render(
    <AppMenuContext.Provider value={{ openMenu: mockOpenMenu }}>
      <DashboardScreen navigation={navigation} route={route} />
    </AppMenuContext.Provider>,
  );
}

const baseProfile = {
  id: 'user-1',
  email: 'athlete@example.com',
  role: 'user',
  displayName: 'Harbir',
  username: 'harbir_b',
  weightUnit: 'kg' as const,
  workoutAccentColor: null as string | null,
  nutritionAccentColor: null as string | null,
  activeWorkoutSplitId: null as string | null,
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockFetchActiveWorkout.mockReset().mockResolvedValue(null);
  mockFetchWorkoutSplitDetail.mockReset();
  mockFetchLastWorkoutSplitDayId.mockReset().mockResolvedValue(null);
  mockFetchTodaysFoodLogs.mockReset().mockResolvedValue([]);
  mockFetchNutritionGoals.mockReset().mockResolvedValue({
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  mockNavigate.mockClear();
  mockOpenMenu.mockClear();
});

describe('DashboardScreen loading/greeting', () => {
  it('shows a loading indicator while fetching', async () => {
    renderDashboard();

    expect(screen.getByTestId('dashboard-loading')).toBeTruthy();

    await screen.findByTestId('dashboard-greeting', {}, { timeout: 5000 });
  });

  it('greets with the display name', async () => {
    renderDashboard();

    expect(await screen.findByTestId('dashboard-greeting')).toHaveTextContent(/, Harbir$/);
  });

  it('falls back to username when displayName is unset', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, displayName: null });

    renderDashboard();

    expect(await screen.findByTestId('dashboard-greeting')).toHaveTextContent(/, harbir_b$/);
  });

  it('never greets with the raw email', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, displayName: null, username: null });

    renderDashboard();

    expect(await screen.findByTestId('dashboard-greeting')).not.toHaveTextContent(
      /athlete@example\.com/,
    );
  });

  it('shows a profile error without crashing the rest of the dashboard', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('profile down'));

    renderDashboard();

    expect(await screen.findByTestId('dashboard-profile-error')).toHaveTextContent('profile down');
    expect(screen.getByTestId('dashboard-start-workout')).toBeTruthy();
  });
});

describe('DashboardScreen primary workout action', () => {
  it('shows Start Workout when there is no active workout', async () => {
    renderDashboard();

    expect(await screen.findByTestId('dashboard-start-workout')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-resume-workout')).toBeNull();
  });

  it('shows Resume when there is an active workout', async () => {
    mockFetchActiveWorkout.mockResolvedValue({
      id: 'active-1',
      name: 'Leg Day',
      performedAt: '2026-01-02T00:00:00Z',
      completedAt: null,
    });

    renderDashboard();

    expect(await screen.findByTestId('dashboard-resume-workout')).toHaveTextContent(/Leg Day/);
    expect(screen.queryByTestId('dashboard-start-workout')).toBeNull();
  });

  it('navigates to NewWorkout when Start Workout is pressed', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-start-workout');

    fireEvent.press(screen.getByTestId('dashboard-start-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');
  });

  it('navigates to ActiveWorkout when Resume is pressed', async () => {
    mockFetchActiveWorkout.mockResolvedValue({
      id: 'active-1',
      name: 'Leg Day',
      performedAt: '2026-01-02T00:00:00Z',
      completedAt: null,
    });

    renderDashboard();
    await screen.findByTestId('dashboard-resume-workout');

    fireEvent.press(screen.getByTestId('dashboard-resume-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'active-1' });
  });

  it('shows an active-workout error without hiding the rest of the dashboard', async () => {
    mockFetchActiveWorkout.mockRejectedValue(new Error('network error'));

    renderDashboard();

    expect(await screen.findByTestId('dashboard-active-workout-error')).toHaveTextContent(
      'network error',
    );
    expect(screen.getByTestId('dashboard-greeting')).toBeTruthy();
  });

  it('keeps showing previously loaded active-workout data if a later background refresh fails', async () => {
    mockFetchActiveWorkout.mockResolvedValue({
      id: 'active-1',
      name: 'Leg Day',
      performedAt: '2026-01-02T00:00:00Z',
      completedAt: null,
    });

    renderDashboard();
    await screen.findByTestId('dashboard-resume-workout');

    mockFetchActiveWorkout.mockRejectedValue(new Error('network error'));
    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    await act(async () => {
      focusCallback();
    });

    await screen.findByTestId('dashboard-active-workout-error');
    // The error is surfaced as a banner, but the last-known-good card must
    // not be erased by it -- there is real data to keep showing.
    expect(screen.getByTestId('dashboard-resume-workout')).toBeTruthy();
  });
});

describe('DashboardScreen mode toggle', () => {
  it('defaults to Workout mode', async () => {
    renderDashboard();

    expect(await screen.findByTestId('dashboard-start-workout')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-nutrition')).toBeNull();
  });

  it('switches to Nutrition mode and back without losing loaded data', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-start-workout');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    expect(await screen.findByTestId('dashboard-nutrition')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-start-workout')).toBeNull();

    fireEvent.press(screen.getByTestId('dashboard-mode-workout'));
    expect(await screen.findByTestId('dashboard-start-workout')).toBeTruthy();
  });
});

describe('DashboardScreen nutrition snapshot', () => {
  it('shows consumed totals with no targets when no goals are set', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([
      {
        id: 'l1',
        foodId: 'f1',
        foodNameSnapshot: 'Chicken',
        servingSize: 100,
        servingUnit: 'g',
        quantity: 1,
        calories: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
        loggedAt: '2026-01-01T12:00:00Z',
      },
    ]);

    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));

    expect(await screen.findByTestId('dashboard-calories')).toHaveTextContent('Calories: 165');
    expect(screen.getByTestId('dashboard-nutrition-no-goals')).toBeTruthy();
  });

  it('shows consumed vs target when goals are configured', async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2000,
      proteinG: 180,
      carbsG: 200,
      fatG: 60,
    });
    mockFetchTodaysFoodLogs.mockResolvedValue([
      {
        id: 'l1',
        foodId: 'f1',
        foodNameSnapshot: 'Chicken',
        servingSize: 100,
        servingUnit: 'g',
        quantity: 1,
        calories: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
        loggedAt: '2026-01-01T12:00:00Z',
      },
    ]);

    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));

    expect(await screen.findByTestId('dashboard-calories')).toHaveTextContent(
      'Calories: 165 / 2000',
    );
    expect(screen.queryByTestId('dashboard-nutrition-no-goals')).toBeNull();
  });

  it('shows an empty (zeroed) snapshot when nothing has been logged today', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));

    expect(await screen.findByTestId('dashboard-calories')).toHaveTextContent('Calories: 0');
  });

  it('navigates to Nutrition when the calories card is pressed', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    fireEvent.press(screen.getByTestId('dashboard-nutrition'));

    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('shows a nutrition error, and switching back to Workout mode still works fine', async () => {
    mockFetchTodaysFoodLogs.mockRejectedValue(new Error('nutrition down'));

    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));

    expect(await screen.findByTestId('dashboard-nutrition-error')).toHaveTextContent(
      'nutrition down',
    );

    fireEvent.press(screen.getByTestId('dashboard-mode-workout'));

    expect(await screen.findByTestId('dashboard-start-workout')).toBeTruthy();
  });

  it('shows real logged meals in the Recent Meals list', async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue([
      {
        id: 'l1',
        foodId: 'f1',
        foodNameSnapshot: 'Chicken Breast',
        servingSize: 100,
        servingUnit: 'g',
        quantity: 1,
        calories: 165,
        proteinG: 31,
        carbsG: 0,
        fatG: 3.6,
        loggedAt: '2026-01-01T12:00:00Z',
      },
    ]);

    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));

    expect(await screen.findByText('Chicken Breast')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-meals-empty')).toBeNull();
  });

  it('shows an empty state when no meals have been logged today', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));

    expect(await screen.findByTestId('dashboard-meals-empty')).toHaveTextContent(
      'No meals logged today',
    );
  });

  it('navigates to NutritionGoals via the Nutrition Goals card', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition-goals-card');

    fireEvent.press(screen.getByTestId('dashboard-nutrition-goals-card'));

    expect(mockNavigate).toHaveBeenCalledWith('NutritionGoals');
  });
});

describe('DashboardScreen secondary navigation', () => {
  it('navigates to AccountSettings via the settings affordance', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('open-account-settings'));

    expect(mockNavigate).toHaveBeenCalledWith('AccountSettings');
  });
});

describe('DashboardScreen partial failure', () => {
  it('still renders workout and nutrition sections when the profile fetch fails', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('profile down'));
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2000,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });

    renderDashboard();

    await waitFor(() => expect(screen.getByTestId('dashboard-profile-error')).toBeTruthy());
    expect(screen.getByTestId('dashboard-start-workout')).toBeTruthy();

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    expect(await screen.findByTestId('dashboard-nutrition')).toBeTruthy();
  });

  it('recovers on the next focus after a failed section', async () => {
    mockFetchTodaysFoodLogs.mockRejectedValueOnce(new Error('nutrition down'));

    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition-error');

    mockFetchTodaysFoodLogs.mockResolvedValue([]);
    // Re-invoke only this render's own focus callback (the most recent
    // addListener registration) -- not every prior test's stale one.
    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    await act(async () => {
      focusCallback();
    });

    await waitFor(() => expect(screen.queryByTestId('dashboard-nutrition-error')).toBeNull());
  });
});

// Regression coverage for a reported bug: returning to Home was blacking out
// the whole screen before the refreshed data arrived. `load()` only sets
// `loading` true on the very first call now (see `hasLoadedOnce` in
// DashboardScreen) -- every later focus-triggered call is a silent
// background refresh that updates state in place.
describe('DashboardScreen background refresh on focus', () => {
  function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  }

  it('does not show the full-screen loading indicator on a focus-triggered refresh', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    const refresh = deferred<null>();
    mockFetchActiveWorkout.mockReturnValue(refresh.promise);

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    act(() => {
      focusCallback();
    });

    // The refresh request is in flight -- the dashboard already on screen
    // must stay up, not be replaced by the full-screen loading state.
    expect(screen.queryByTestId('dashboard-loading')).toBeNull();
    expect(screen.getByTestId('dashboard-greeting')).toBeTruthy();

    await act(async () => {
      refresh.resolve(null);
      await refresh.promise;
    });
  });

  it('updates dashboard data after returning home (e.g. a newly completed workout) without ever blanking the screen', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-start-workout');

    const refresh = deferred<{
      id: string;
      name: string;
      performedAt: string;
      completedAt: string | null;
    }>();
    mockFetchActiveWorkout.mockReturnValue(refresh.promise);

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    act(() => {
      focusCallback();
    });

    expect(screen.queryByTestId('dashboard-loading')).toBeNull();

    await act(async () => {
      refresh.resolve({
        id: 'active-2',
        name: 'Push Day',
        performedAt: '2026-01-03T00:00:00Z',
        completedAt: null,
      });
      await refresh.promise;
    });

    expect(await screen.findByTestId('dashboard-resume-workout')).toHaveTextContent(/Push Day/);
    expect(screen.queryByTestId('dashboard-loading')).toBeNull();
  });

  it('does not issue a duplicate fetch beyond the one triggered by the focus event', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    const callsAfterInitialLoad = mockFetchActiveWorkout.mock.calls.length;

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    await act(async () => {
      focusCallback();
    });

    expect(mockFetchActiveWorkout.mock.calls.length).toBe(callsAfterInitialLoad + 1);
  });
});

describe('DashboardScreen fixed header/footer layout', () => {
  it('keeps the mode toggle and bottom navigation outside the scrollable area', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    const scrollArea = screen.getByTestId('dashboard-scroll');
    // These are fixed siblings of the ScrollView, not children of it -- so
    // they must never be found *within* the scrollable content.
    expect(within(scrollArea).queryByTestId('dashboard-fixed-header')).toBeNull();
    expect(within(scrollArea).queryByTestId('dashboard-mode-workout')).toBeNull();
    expect(within(scrollArea).queryByTestId('dashboard-bottom-bar')).toBeNull();

    expect(screen.getByTestId('dashboard-fixed-header')).toBeTruthy();
    expect(screen.getByTestId('dashboard-mode-workout')).toBeTruthy();
    expect(screen.getByTestId('dashboard-bottom-bar')).toBeTruthy();
  });

  it('keeps the fixed header and bottom navigation present after switching modes', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    expect(screen.getByTestId('dashboard-fixed-header')).toBeTruthy();
    expect(screen.getByTestId('dashboard-mode-workout')).toBeTruthy();
    expect(screen.getByTestId('dashboard-bottom-bar')).toBeTruthy();

    fireEvent.press(screen.getByTestId('dashboard-mode-workout'));
    await screen.findByTestId('dashboard-start-workout');

    expect(screen.getByTestId('dashboard-fixed-header')).toBeTruthy();
    expect(screen.getByTestId('dashboard-bottom-bar')).toBeTruthy();
  });

  it('insets the scrollable content to match the measured header/footer heights, not a hardcoded value', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent(screen.getByTestId('dashboard-fixed-header'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 180 } },
    });
    fireEvent(screen.getByTestId('dashboard-bottom-bar'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 100 } },
    });

    const scroll = screen.getByTestId('dashboard-scroll');
    const merged = Object.assign({}, ...[scroll.props.contentContainerStyle].flat());

    expect(merged.paddingTop).toBe(180 + 16);
    expect(merged.paddingBottom).toBe(100 + 16);
  });
});

describe('DashboardScreen mode-based accent theme', () => {
  it('uses the workout blue accent for the toggle and bottom navigation by default', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    const workoutSegment = screen.getByTestId('dashboard-mode-workout');
    const workoutIcon = within(workoutSegment).UNSAFE_getByType(Feather);
    expect(workoutIcon.props.color).toBe(DEFAULT_WORKOUT_THEME.onAccent);

    const nutritionSegment = screen.getByTestId('dashboard-mode-nutrition');
    const nutritionIcon = within(nutritionSegment).UNSAFE_getByType(Feather);
    expect(nutritionIcon.props.color).not.toBe(DEFAULT_NUTRITION_THEME.onAccent);

    const homeIcon = within(screen.getByTestId('dashboard-bottom-bar')).UNSAFE_getByProps({
      name: 'home',
    });
    expect(homeIcon.props.color).toBe(DEFAULT_WORKOUT_THEME.accent);
  });

  it('switches the toggle and bottom navigation to the nutrition green accent after switching modes', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    const nutritionSegment = screen.getByTestId('dashboard-mode-nutrition');
    const nutritionIcon = within(nutritionSegment).UNSAFE_getByType(Feather);
    expect(nutritionIcon.props.color).toBe(DEFAULT_NUTRITION_THEME.onAccent);

    const homeIcon = within(screen.getByTestId('dashboard-bottom-bar')).UNSAFE_getByProps({
      name: 'home',
    });
    expect(homeIcon.props.color).toBe(DEFAULT_NUTRITION_THEME.accent);

    const target = within(screen.getByTestId('dashboard-nutrition-goals-card')).UNSAFE_getByProps({
      name: 'target',
    });
    expect(target.props.color).toBe(DEFAULT_NUTRITION_THEME.accent);
  });

  it("uses the user's saved custom workout color instead of the default", async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, workoutAccentColor: '#EF4444' });

    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    const homeIcon = within(screen.getByTestId('dashboard-bottom-bar')).UNSAFE_getByProps({
      name: 'home',
    });
    expect(homeIcon.props.color).toBe('#EF4444');
    expect(homeIcon.props.color).not.toBe(DEFAULT_WORKOUT_THEME.accent);
  });

  it("uses the user's saved custom nutrition color instead of the default, independently of the workout color", async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      workoutAccentColor: '#EF4444',
      nutritionAccentColor: '#8B5CF6',
    });

    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    const homeIcon = within(screen.getByTestId('dashboard-bottom-bar')).UNSAFE_getByProps({
      name: 'home',
    });
    expect(homeIcon.props.color).toBe('#8B5CF6');
    expect(homeIcon.props.color).not.toBe('#EF4444');
  });
});

describe('DashboardScreen dynamic Next Workout card', () => {
  const ppl = {
    id: 'split-1',
    name: 'PPL - Hypertrophy',
    days: [
      { id: 'day-push', name: 'Push', orderIndex: 1, muscleGroups: ['chest', 'triceps'] },
      { id: 'day-pull', name: 'Pull', orderIndex: 2, muscleGroups: ['back', 'biceps'] },
    ],
  };

  it('shows the plain placeholder when there is no active split', async () => {
    renderDashboard();

    expect(await screen.findByTestId('dashboard-start-workout')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-next-workout')).toBeNull();
  });

  it('shows the recommended next day, split name, and a "let\'s get started" message with no history', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();

    const card = await screen.findByTestId('dashboard-next-workout');
    expect(card).toHaveTextContent(/Push/);
    expect(card).toHaveTextContent(/PPL - Hypertrophy/);
    expect(card).toHaveTextContent(/Let's get started\./);
  });

  it('shows the "you completed X last" message and the following day when there is history', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue('day-push');

    renderDashboard();

    const card = await screen.findByTestId('dashboard-next-workout');
    expect(card).toHaveTextContent(/Pull/);
    expect(card).toHaveTextContent(/You completed Push last\. Time to hit Pull\./);
  });

  it('renders the muscle visualization for the recommended day', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-muscle-visualization')).toBeTruthy();
  });

  it("shows the recommended day's muscle groups from the structured split-day data", async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-next-workout-muscles')).toHaveTextContent(
      'Chest • Triceps',
    );
  });

  it('labels the secondary action "Change"', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-change-split')).toHaveTextContent('Change');
  });

  it('navigates to NewWorkout when Start Workout is pressed', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-start-next-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');
  });

  it('navigates to WorkoutSplits when Change Split is pressed', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-change-split'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplits');
  });

  it('falls back to the plain placeholder when the active split has no days', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue({ id: 'split-1', name: 'Empty', days: [] });
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-start-workout')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-next-workout')).toBeNull();
  });

  it('falls back to the plain placeholder when loading the split fails', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockRejectedValue(new Error('network down'));

    renderDashboard();

    expect(await screen.findByTestId('dashboard-start-workout')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-next-workout')).toBeNull();
  });

  it('shows the resume-workout card instead, even with an active split, when a workout is already in progress', async () => {
    mockFetchActiveWorkout.mockResolvedValue({
      id: 'active-1',
      name: 'Leg Day',
      performedAt: '2026-01-02T00:00:00Z',
      completedAt: null,
    });
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-resume-workout')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-next-workout')).toBeNull();
  });
});

describe('DashboardScreen bottom bar Progress navigation', () => {
  it('navigates to Progress when the Progress item is pressed in Workout mode', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-bottom-progress'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressOverview');
  });

  it('is disabled in Nutrition mode (the item shows Goals there instead)', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    fireEvent.press(screen.getByTestId('dashboard-bottom-progress'));

    expect(mockNavigate).not.toHaveBeenCalledWith('ProgressOverview');
  });
});

describe('DashboardScreen bottom bar Workouts/Plus/Social', () => {
  it('navigates to WorkoutHistory from the bottom bar in Workout mode', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-bottom-workouts'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutHistory');
  });

  it('navigates to Nutrition from the bottom bar (now "Food") in Nutrition mode', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    fireEvent.press(screen.getByTestId('dashboard-bottom-workouts'));

    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('navigates to Social when the Social item is pressed', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-bottom-social'));

    expect(mockNavigate).toHaveBeenCalledWith('Social');
  });

  it('opens the quick action menu when the + button is pressed', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-bottom-plus'));

    expect(screen.getByTestId('quick-action-start-workout')).toBeTruthy();
    expect(screen.getByTestId('quick-action-log-food')).toBeTruthy();
  });

  it('navigates to NewWorkout and closes the menu when Start Workout is chosen', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');
    fireEvent.press(screen.getByTestId('dashboard-bottom-plus'));

    fireEvent.press(screen.getByTestId('quick-action-start-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');
    expect(screen.queryByTestId('quick-action-start-workout')).toBeNull();
  });

  it('navigates to Nutrition and closes the menu when Log Food is chosen', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');
    fireEvent.press(screen.getByTestId('dashboard-bottom-plus'));

    fireEvent.press(screen.getByTestId('quick-action-log-food'));

    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
    expect(screen.queryByTestId('quick-action-log-food')).toBeNull();
  });
});

describe('DashboardScreen app-level side menu', () => {
  // AppSideMenu itself is now mounted once at the app root (App.tsx), as a
  // sibling of the navigator, so it can render above the ENTIRE app instead
  // of being clipped inside Dashboard's own content bounds -- see
  // App.test.tsx for the actual open/navigate/close/layering behavior.
  // DashboardScreen's own responsibility is just asking the root to open it.
  it('asks the app-level menu to open when the hamburger button is pressed', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalled();
  });

  it('remains reachable after switching to Nutrition mode', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');
    fireEvent.press(screen.getByTestId('dashboard-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalled();
  });
});
