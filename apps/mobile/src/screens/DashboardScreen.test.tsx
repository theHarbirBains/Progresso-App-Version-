import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { DashboardStat } from '../dashboard/DashboardStat';
import { fetchRecentWorkoutInfo } from '../dashboard/recentWorkoutInfo';
import { getCurrentWeekRange } from '../dashboard/weeklyProgress';
import { AppCard } from '../design/AppCard';
import { BackgroundThemeProvider } from '../design/BackgroundThemeContext';
import { colors, radii, widgetGap } from '../design/theme';
import { getMyProfile } from '../lib/api';
import { AppMenuContext } from '../navigation/AppMenuContext';
import { fetchTodaysFoodLogs, fetchWeeklyFoodLogs } from '../nutrition/foodLogQueries';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { fetchAllCompletedWorkouts } from '../progress/progressStatsQueries';
import { fetchAllExerciseHistory } from '../workouts/allExerciseHistoryQueries';
import { fetchActiveWorkout, fetchWorkoutsForDateRange } from '../workouts/workoutQueries';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { DEFAULT_NUTRITION_THEME, DEFAULT_WORKOUT_THEME } from '../theme/accentColor';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { DashboardScreen } from './DashboardScreen';
import { dashboardStyles } from './dashboardStyles';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
}));

jest.mock('../workouts/workoutQueries', () => ({
  fetchActiveWorkout: jest.fn(),
  fetchWorkoutsForDateRange: jest.fn(),
}));

jest.mock('../workouts/workoutSplitQueries', () => ({
  fetchWorkoutSplitDetail: jest.fn(),
  fetchLastWorkoutSplitDayId: jest.fn(),
}));

jest.mock('../progress/progressStatsQueries', () => ({
  fetchAllCompletedWorkouts: jest.fn(),
}));

jest.mock('../workouts/allExerciseHistoryQueries', () => ({
  fetchAllExerciseHistory: jest.fn(),
}));

jest.mock('../nutrition/foodLogQueries', () => ({
  fetchTodaysFoodLogs: jest.fn(),
  fetchWeeklyFoodLogs: jest.fn(),
}));

jest.mock('../nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
}));

jest.mock('../dashboard/recentWorkoutInfo', () => ({
  fetchRecentWorkoutInfo: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockFetchActiveWorkout = fetchActiveWorkout as jest.Mock;
const mockFetchWorkoutSplitDetail = fetchWorkoutSplitDetail as jest.Mock;
const mockFetchLastWorkoutSplitDayId = fetchLastWorkoutSplitDayId as jest.Mock;
const mockFetchTodaysFoodLogs = fetchTodaysFoodLogs as jest.Mock;
const mockFetchWeeklyFoodLogs = fetchWeeklyFoodLogs as jest.Mock;
const mockFetchNutritionGoals = fetchNutritionGoals as jest.Mock;
const mockFetchAllCompletedWorkouts = fetchAllCompletedWorkouts as jest.Mock;
const mockFetchAllExerciseHistory = fetchAllExerciseHistory as jest.Mock;
const mockFetchWorkoutsForDateRange = fetchWorkoutsForDateRange as jest.Mock;
const mockFetchRecentWorkoutInfo = fetchRecentWorkoutInfo as jest.Mock;

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
const mockReportMode = jest.fn();

// DashboardScreen now only asks the root-level AppSideMenu to open (via
// AppMenuContext) rather than rendering/owning the drawer itself -- see
// App.tsx, where AppSideMenu is mounted as a sibling of the navigator so it
// can render above the ENTIRE app instead of being clipped inside any one
// screen. This helper stands in for that root-level provider.
//
// Stateful, not a static value: DashboardScreen no longer owns its own
// `mode` state -- it renders directly off `currentMode` (see the fix for
// the "switching to Nutrition elsewhere flashes back to Workout on
// Dashboard" regression, below), so the fake provider has to actually
// update `currentMode` when `reportMode` is called, the same way App.tsx's
// real `Root` does, or the toggle would appear inert in these tests.
function TestAppMenuProvider({
  initialMode = 'workout',
  children,
}: {
  initialMode?: 'workout' | 'nutrition';
  children: ReactNode;
}) {
  const [currentMode, setCurrentMode] = useState<'workout' | 'nutrition'>(initialMode);
  return (
    <AppMenuContext.Provider
      value={{
        openMenu: mockOpenMenu,
        reportMode: (next) => {
          mockReportMode(next);
          setCurrentMode(next);
        },
        currentMode,
      }}
    >
      {children}
    </AppMenuContext.Provider>
  );
}

function renderDashboard(initialMode: 'workout' | 'nutrition' = 'workout') {
  return render(
    <BackgroundThemeProvider>
      <TestAppMenuProvider initialMode={initialMode}>
        <DashboardScreen navigation={navigation} route={route} />
      </TestAppMenuProvider>
    </BackgroundThemeProvider>,
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
  mockFetchWeeklyFoodLogs.mockReset().mockResolvedValue([]);
  mockFetchNutritionGoals.mockReset().mockResolvedValue({
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  mockFetchAllCompletedWorkouts.mockReset().mockResolvedValue([]);
  mockFetchAllExerciseHistory.mockReset().mockResolvedValue([]);
  mockFetchWorkoutsForDateRange.mockReset().mockResolvedValue([]);
  mockFetchRecentWorkoutInfo.mockReset().mockResolvedValue(null);
  mockNavigate.mockClear();
  mockOpenMenu.mockClear();
  mockReportMode.mockClear();
});

describe('DashboardScreen loading', () => {
  it('shows a loading indicator while fetching', async () => {
    renderDashboard();

    expect(screen.getByTestId('dashboard-loading')).toBeTruthy();

    await screen.findByTestId('dashboard-screen', {}, { timeout: 5000 });
  });

  it('shows no greeting, name, or time-of-day welcome in Workout mode', async () => {
    renderDashboard();

    await screen.findByTestId('dashboard-screen');
    expect(screen.queryByTestId('dashboard-greeting')).toBeNull();
    expect(screen.queryByTestId('dashboard-greeting-eyebrow')).toBeNull();
    expect(screen.queryByText(/good (morning|afternoon|evening)/i)).toBeNull();
    // The greeting used the profile's name -- it must not appear anywhere.
    expect(screen.queryByText('Harbir')).toBeNull();
    expect(screen.queryByText(/harbir_b/)).toBeNull();
  });

  it('shows no greeting, name, or time-of-day welcome in Nutrition mode', async () => {
    renderDashboard('nutrition');

    await screen.findByTestId('dashboard-nutrition');
    expect(screen.queryByTestId('dashboard-greeting')).toBeNull();
    expect(screen.queryByTestId('dashboard-greeting-eyebrow')).toBeNull();
    expect(screen.queryByTestId('dashboard-nutrition-greeting-row')).toBeNull();
    expect(screen.queryByText(/good (morning|afternoon|evening)/i)).toBeNull();
    expect(screen.queryByText('Harbir')).toBeNull();
  });

  it('shows no profile picture or avatar on the main dashboard', async () => {
    renderDashboard();

    await screen.findByTestId('dashboard-screen');
    expect(screen.queryByTestId('open-account-settings')).toBeNull();
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
    expect(screen.getByTestId('dashboard-screen')).toBeTruthy();
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

  // Regression coverage: Dashboard used to own a separate local `mode`
  // state defaulting to 'workout', so navigating here (a pop back to an
  // already-mounted screen, not a remount -- native stack's `navigate`
  // behavior) after switching to Nutrition on another screen would render
  // Dashboard in Workout mode for a moment, then even re-report 'workout'
  // as the shared mode itself, undoing the switch. Dashboard now renders
  // directly off the shared `currentMode` instead of a state of its own, so
  // there is nothing to resync and nothing to self-report on mount.
  it('renders in Nutrition mode immediately if that is already the shared mode on mount -- no flash back to Workout', async () => {
    renderDashboard('nutrition');

    expect(await screen.findByTestId('dashboard-nutrition')).toBeTruthy();
    expect(screen.queryByTestId('dashboard-start-workout')).toBeNull();
    expect(mockReportMode).not.toHaveBeenCalled();
  });

  it('reports each mode change to the background layer, so it can follow the toggle', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-start-workout');
    mockReportMode.mockClear();

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    expect(mockReportMode).toHaveBeenCalledWith('nutrition');

    fireEvent.press(screen.getByTestId('dashboard-mode-workout'));
    await screen.findByTestId('dashboard-start-workout');

    expect(mockReportMode).toHaveBeenCalledWith('workout');
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

    expect(await screen.findByTestId('dashboard-calories')).toHaveTextContent('165');
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

    expect(await screen.findByTestId('dashboard-calories')).toHaveTextContent('165 / 2,000');
    expect(screen.queryByTestId('dashboard-nutrition-no-goals')).toBeNull();
  });

  it('shows an empty (zeroed) snapshot when nothing has been logged today', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));

    expect(await screen.findByTestId('dashboard-calories')).toHaveTextContent('0');
  });

  it('navigates to Nutrition when the calories card is pressed', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    fireEvent.press(screen.getByTestId('dashboard-nutrition'));

    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('navigates to the barcode scanner when the Scan Barcode quick action is pressed', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    fireEvent.press(screen.getByTestId('dashboard-quick-scan'));

    expect(mockNavigate).toHaveBeenCalledWith('BarcodeScanner');
  });

  it("navigates to Nutrition when Today's Meals header row is pressed", async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    fireEvent.press(screen.getByTestId('dashboard-view-meals'));

    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('shows the Weekly Calories title without a "View All" link', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    expect(screen.getByTestId('dashboard-weekly-calories-card')).toHaveTextContent(
      /Weekly Calories/,
    );
    expect(screen.queryByTestId('dashboard-weekly-calories-view-all')).toBeNull();
    expect(screen.getByTestId('dashboard-weekly-calories-card')).not.toHaveTextContent(/View All/);
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

  it("shows real logged meals in the Today's Meals list", async () => {
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

  it('has no standalone section-header labels above its widgets -- condensed, card-only layout', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    expect(screen.queryByText('Calories Today')).toBeNull();
    // "Today's Meals" is a real title, but it lives inside the card's own
    // header row (icon + title + chevron, tappable), not as a standalone
    // label sitting above the card.
    expect(screen.getByText("Today's Meals")).toBeTruthy();
    expect(screen.getByTestId('dashboard-view-meals')).toBeTruthy();
  });

  it('shows an honest empty state for Weekly Calories (never a fake number) when no daily target is set, with no Nutrition Goals card', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    expect(screen.getByTestId('dashboard-weekly-calories-card')).toHaveTextContent(
      /Weekly Calories/,
    );
    expect(screen.getByTestId('dashboard-weekly-calories-card')).toHaveTextContent(
      /Set your weekly calorie goal/,
    );
    expect(screen.queryByTestId('dashboard-weekly-calories-target')).toBeNull();
    expect(screen.queryByTestId('dashboard-nutrition-goals-card')).toBeNull();
  });

  it('shows the real weekly target (daily target x7) and remaining calories once a daily target is set', async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2000,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    mockFetchWeeklyFoodLogs.mockResolvedValue([
      {
        id: 'w1',
        foodId: 'f1',
        foodNameSnapshot: 'Chicken',
        servingSize: 100,
        servingUnit: 'g',
        quantity: 1,
        calories: 7000,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        loggedAt: '2026-01-01T12:00:00Z',
      },
    ]);

    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));

    expect(await screen.findByTestId('dashboard-weekly-calories-target')).toHaveTextContent(
      /14,000/,
    );
    // Just the two real numbers -- no sentence/explanatory text.
    expect(screen.getByTestId('dashboard-weekly-calories-consumed')).toHaveTextContent('7,000');
    expect(screen.getByTestId('dashboard-weekly-calories-remaining')).toHaveTextContent('7,000');
    expect(screen.getByTestId('dashboard-weekly-calories-card')).not.toHaveTextContent(
      /remain for the week/,
    );
  });

  it('shows a negative remaining number (never hidden/reworded) once the week is over budget', async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2000,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    mockFetchWeeklyFoodLogs.mockResolvedValue([
      {
        id: 'w1',
        foodId: 'f1',
        foodNameSnapshot: 'Chicken',
        servingSize: 100,
        servingUnit: 'g',
        quantity: 1,
        calories: 15000,
        proteinG: 0,
        carbsG: 0,
        fatG: 0,
        loggedAt: '2026-01-01T12:00:00Z',
      },
    ]);

    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));

    expect(await screen.findByTestId('dashboard-weekly-calories-consumed')).toHaveTextContent(
      '15,000',
    );
    expect(screen.getByTestId('dashboard-weekly-calories-remaining')).toHaveTextContent('-1,000');
  });

  it('fetches the weekly food logs using the same Monday-start week Workout Mode already uses', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    expect(mockFetchWeeklyFoodLogs).toHaveBeenCalledWith('user-1');
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
    await screen.findByTestId('dashboard-screen');

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
    expect(screen.getByTestId('dashboard-screen')).toBeTruthy();

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
    await screen.findByTestId('dashboard-screen');

    const callsAfterInitialLoad = mockFetchActiveWorkout.mock.calls.length;

    const calls = navigation.addListener.mock.calls;
    const [, focusCallback] = calls[calls.length - 1];
    await act(async () => {
      focusCallback();
    });

    expect(mockFetchActiveWorkout.mock.calls.length).toBe(callsAfterInitialLoad + 1);
  });
});

describe('DashboardScreen fixed header layout', () => {
  it('keeps the mode toggle outside the scrollable area', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    const scrollArea = screen.getByTestId('dashboard-scroll');
    // The header is a fixed sibling of the ScrollView, not a child of it --
    // so it must never be found *within* the scrollable content.
    expect(within(scrollArea).queryByTestId('dashboard-fixed-header')).toBeNull();
    expect(within(scrollArea).queryByTestId('dashboard-mode-workout')).toBeNull();

    expect(screen.getByTestId('dashboard-fixed-header')).toBeTruthy();
    expect(screen.getByTestId('dashboard-mode-workout')).toBeTruthy();
  });

  it('keeps the fixed header present after switching modes', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    expect(screen.getByTestId('dashboard-fixed-header')).toBeTruthy();
    expect(screen.getByTestId('dashboard-mode-workout')).toBeTruthy();

    fireEvent.press(screen.getByTestId('dashboard-mode-workout'));
    await screen.findByTestId('dashboard-start-workout');

    expect(screen.getByTestId('dashboard-fixed-header')).toBeTruthy();
  });

  // The bottom navigation is the app-level BottomNavBar (App.tsx), an in-flow
  // sibling of the navigator -- Dashboard renders no bar of its own, and so
  // measures no footer.
  it('renders no bottom navigation of its own', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    expect(screen.queryByTestId('dashboard-bottom-bar')).toBeNull();
    expect(screen.queryByTestId('bottom-nav-bar')).toBeNull();
    expect(screen.queryByTestId('quick-action-start-workout')).toBeNull();
  });

  it('insets the scrollable content to match the measured header height, not a hardcoded value', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    fireEvent(screen.getByTestId('dashboard-fixed-header'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 180 } },
    });

    const scroll = screen.getByTestId('dashboard-scroll');
    const merged = Object.assign({}, ...[scroll.props.contentContainerStyle].flat());

    expect(merged.paddingTop).toBe(180 + 12);
    // No footer is measured, and the gap under the last widget is the same
    // 6px widget rhythm -- the bottom navigation (an in-flow sibling) owns
    // the safe-area inset, so nothing here needs to add one.
    expect(merged.paddingBottom).toBe(widgetGap);
  });

  it('stacks Workout widgets at a fixed widgetGap and never stretches/distributes leftover height between them', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    const workoutStyle = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-scroll').props.contentContainerStyle].flat(),
    );
    expect(workoutStyle.gap).toBe(widgetGap);
    // The old flexGrow + space-between stretched every gap to fill the
    // device's leftover height -- exactly what breaks a strict max gap.
    // None of the distributing modes may ever return.
    expect(['space-between', 'space-around', 'space-evenly']).not.toContain(
      workoutStyle.justifyContent,
    );
  });

  // Spare height on a tall phone used to be an empty band -- first at the
  // bottom, then (when the stack was pushed down) directly under the mode
  // switcher. The widgets themselves now share it, so they run from the
  // switcher to the bottom navigation. Gaps stay exactly widgetGap.
  describe('fills the space from the mode switcher to the bottom navigation', () => {
    const style = (testID: string) =>
      Object.assign({}, ...[screen.getByTestId(testID).props.style].flat(Infinity));
    const stack = () =>
      Object.assign(
        {},
        ...[screen.getByTestId('dashboard-scroll').props.contentContainerStyle].flat(),
      );

    it('makes the stack at least as tall as the scroll area, top-aligned, with the 6px rhythm intact', async () => {
      renderDashboard();
      await screen.findByTestId('dashboard-screen');

      expect(stack().flexGrow).toBe(1);
      // Top-aligned: nothing pushes the widgets down or to an edge.
      expect(stack().justifyContent).toBeUndefined();
      expect(stack().gap).toBe(widgetGap);
      expect(stack().paddingBottom).toBe(widgetGap);
      // No negative margins or offset hacks.
      expect(stack().marginBottom).toBeUndefined();
      expect(stack().marginTop).toBeUndefined();
    });

    it('shares spare height between the three widgets in proportion to their natural heights', async () => {
      mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
      mockFetchWorkoutSplitDetail.mockResolvedValue({
        id: 'split-1',
        name: 'PPL',
        days: [{ id: 'd1', name: 'Push', orderIndex: 1, muscleGroups: ['chest'] }],
      });
      mockFetchRecentWorkoutInfo.mockResolvedValue({
        workout: {
          id: 'w1',
          name: 'Pull Day',
          performedAt: '2026-09-18T17:00:00.000Z',
          completedAt: '2026-09-18T17:40:00.000Z',
          workoutSplitDayId: null,
        },
        musclesTrained: 'Back',
        durationMinutes: 40,
        topExerciseName: null,
        topExerciseSets: [],
        previousExerciseSets: [],
        topSet: null,
        prLabel: null,
      });
      renderDashboard();
      await screen.findByTestId('dashboard-recent-workout');

      // The weight lives on each widget's wrapper -- the direct child of the
      // stack that shares the spare height -- so read the largest flexGrow on
      // the path from the card up to (not including) the scroll container.
      const wrapperGrow = (testID: string) => {
        let max = 0;
        let node: ReturnType<typeof screen.getByTestId> | null = screen.getByTestId(testID);
        while (node && node.props.testID !== 'dashboard-scroll') {
          const grow = Object.assign({}, ...[node.props.style].flat(Infinity)).flexGrow;
          if (typeof grow === 'number') max = Math.max(max, grow);
          node = node.parent;
        }
        return max;
      };
      const heroGrow = wrapperGrow('dashboard-next-workout');
      const activityGrow = wrapperGrow('dashboard-activity');
      const recentGrow = wrapperGrow('dashboard-recent-workout');

      expect(heroGrow).toBeGreaterThan(0);
      expect(activityGrow).toBeGreaterThan(0);
      expect(recentGrow).toBeGreaterThan(0);
      // The two big widgets take the larger shares; the small Recent card less.
      expect(recentGrow).toBeLessThan(heroGrow);
      expect(recentGrow).toBeLessThan(activityGrow);
    });

    it("lets each card absorb the height without stretching its contents' gaps", async () => {
      mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
      mockFetchWorkoutSplitDetail.mockResolvedValue({
        id: 'split-1',
        name: 'PPL',
        days: [{ id: 'd1', name: 'Push', orderIndex: 1, muscleGroups: ['chest'] }],
      });
      renderDashboard();
      await screen.findByTestId('dashboard-next-workout');

      // Next Workout: text on top, actions anchored beneath -- not a card
      // whose every line drifts apart.
      const hero = style('dashboard-next-workout');
      expect(hero.flexGrow).toBe(1);
      expect(hero.justifyContent).toBe('space-between');

      // Activity: the week strip stays natural; the stat grid's rows grow.
      expect(style('dashboard-activity').flexGrow).toBe(1);
      expect(style('dashboard-stat-grid').flexGrow).toBe(1);
    });

    it('keeps the one-line resume and "no upcoming workout" cards compact -- they never grow', async () => {
      renderDashboard();
      const noPlan = await screen.findByTestId('dashboard-start-workout');

      const wrapperStyle = Object.assign(
        {},
        ...[noPlan.parent!.parent!.props.style].flat(Infinity),
      );
      expect(wrapperStyle.flexGrow).toBeUndefined();
    });

    it('never distributes spare height into the gaps: the gap is the 6px token, never a flexed space', () => {
      expect(dashboardStyles.widgetStack.gap).toBe(widgetGap);
      expect(
        (dashboardStyles.workoutStackFill as { justifyContent?: string }).justifyContent,
      ).toBeUndefined();
    });
  });

  it('keeps the widgets clear of the fixed header however much height is spare', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    fireEvent(screen.getByTestId('dashboard-fixed-header'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 190 } },
    });

    const style = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-scroll').props.contentContainerStyle].flat(),
    );
    // Bottom-anchored content can never slide under the header: the top
    // padding still tracks the measured header.
    expect(style.paddingTop).toBe(190 + 12);
  });

  // Accessibility: Nutrition mode used to be a fixed, non-scrolling View whose
  // widgets were squeezed to fit -- it clips at larger Dynamic Type sizes,
  // since a layout that can't grow can't hold bigger text. It now scrolls
  // (only when its content genuinely exceeds the viewport) exactly like
  // Workout mode does.
  it('renders Nutrition mode in a ScrollView, so larger text sizes can never clip its widgets', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    // Exactly one ScrollView at a time: the Nutrition one (Workout's is
    // unmounted while Nutrition is showing), with its own testID.
    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(1);
    expect(screen.queryByTestId('dashboard-scroll')).toBeNull();
    expect(screen.getByTestId('dashboard-nutrition-content')).toBeTruthy();

    const content = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-nutrition-content').props.contentContainerStyle].flat(
        Infinity,
      ),
    );
    // Widgets keep their natural size: nothing stretches or is squeezed.
    expect(content.flexGrow).toBeUndefined();
    expect(content.justifyContent).toBeUndefined();

    // Switching back to Workout mode restores its own ScrollView.
    fireEvent.press(screen.getByTestId('dashboard-mode-workout'));
    await screen.findByTestId('dashboard-start-workout');
    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(1);
    expect(screen.getByTestId('dashboard-scroll')).toBeTruthy();
  });

  it('insets Nutrition content below the measured header, like Workout mode', async () => {
    renderDashboard('nutrition');
    await screen.findByTestId('dashboard-nutrition');

    fireEvent(screen.getByTestId('dashboard-fixed-header'), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 170 } },
    });

    const merged = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-nutrition-content').props.contentContainerStyle].flat(
        Infinity,
      ),
    );
    expect(merged.paddingTop).toBe(170 + 12);
    expect(merged.paddingBottom).toBe(16);
  });

  // Root cause of a real "large empty area inside the card" bug: an
  // earlier pass made Weekly Calories flexGrow to fill whatever leftover
  // space the widgets above it didn't use, which stretched the card and
  // left a big gap between its stats row and its own bottom edge. This
  // card is now sized purely by its own content -- if the stack above is
  // shorter than the screen, the leftover space is a trailing gap below
  // the card (above the bottom nav), not empty space stretched inside it.
  it('sizes Weekly Calories by its own content -- no flexGrow, so it never stretches to fill leftover screen space', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    const weeklyCard = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-weekly-calories-card').props.style].flat(Infinity),
    );
    expect(weeklyCard.flexGrow).toBeUndefined();

    const contentFillStyle = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-weekly-calories-content').props.style].flat(Infinity),
    );
    expect(contentFillStyle.flexGrow).toBeUndefined();
  });

  // The old fixed-height layout needed a "shrink pool": Quick Actions and
  // Today's Meals carried flexShrink + minHeight so they could be squeezed
  // to make everything fit, which is exactly what clipped text at larger
  // sizes. With a scrolling layout nothing is ever squeezed -- so no widget
  // may carry a shrink or a height floor/ceiling that could clip its content.
  it('never squeezes or clamps a Nutrition widget: no flexShrink, minHeight, maxHeight or fixed height', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    for (const testID of [
      'dashboard-nutrition-hero-section',
      'dashboard-nutrition-quick-actions-section',
      'dashboard-nutrition-meals-section',
      'dashboard-weekly-calories-card',
    ]) {
      const style = Object.assign({}, ...[screen.getByTestId(testID).props.style].flat(Infinity));
      expect(style.flexShrink).toBeUndefined();
      expect(style.minHeight).toBeUndefined();
      expect(style.maxHeight).toBeUndefined();
      expect(style.height).toBeUndefined();
    }
  });
});

describe('DashboardScreen mode-based accent theme', () => {
  it('uses the workout blue accent for the toggle and widgets by default', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    const workoutSegment = screen.getByTestId('dashboard-mode-workout');
    const workoutIcon = within(workoutSegment).UNSAFE_getByType(Feather);
    expect(workoutIcon.props.color).toBe(DEFAULT_WORKOUT_THEME.onAccent);

    const nutritionSegment = screen.getByTestId('dashboard-mode-nutrition');
    const nutritionIcon = within(nutritionSegment).UNSAFE_getByType(Feather);
    expect(nutritionIcon.props.color).not.toBe(DEFAULT_NUTRITION_THEME.onAccent);

    // Workout Home's accent shows on its one quiet header action.
    const action = within(screen.getByTestId('dashboard-weekly-view-details')).getByText(
      'View Details',
    );
    expect(StyleSheet.flatten(action.props.style).color).toBe(DEFAULT_WORKOUT_THEME.accent);
  });

  it('switches the toggle and widgets to the nutrition green accent after switching modes', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    const nutritionSegment = screen.getByTestId('dashboard-mode-nutrition');
    const nutritionIcon = within(nutritionSegment).UNSAFE_getByType(Feather);
    expect(nutritionIcon.props.color).toBe(DEFAULT_NUTRITION_THEME.onAccent);

    const searchIcon = within(screen.getByTestId('dashboard-quick-search')).UNSAFE_getByProps({
      name: 'search',
    });
    expect(searchIcon.props.color).toBe(DEFAULT_NUTRITION_THEME.accent);
  });

  it("uses the user's saved custom workout color instead of the default", async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, workoutAccentColor: '#EF4444' });

    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    const action = within(screen.getByTestId('dashboard-weekly-view-details')).getByText(
      'View Details',
    );
    const color = StyleSheet.flatten(action.props.style).color;
    expect(color).toBe('#EF4444');
    expect(color).not.toBe(DEFAULT_WORKOUT_THEME.accent);
  });

  it("uses the user's saved custom nutrition color instead of the default, independently of the workout color", async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      workoutAccentColor: '#EF4444',
      nutritionAccentColor: '#8B5CF6',
    });

    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    const searchIcon = within(screen.getByTestId('dashboard-quick-search')).UNSAFE_getByProps({
      name: 'search',
    });
    expect(searchIcon.props.color).toBe('#8B5CF6');
    expect(searchIcon.props.color).not.toBe('#EF4444');
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

  it('shows the recommended next day and split name with no history', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();

    const card = await screen.findByTestId('dashboard-next-workout');
    expect(card).toHaveTextContent(/Push/);
    expect(card).toHaveTextContent(/PPL - Hypertrophy/);
  });

  it('shows the following day when there is history, without a hardcoded message', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue('day-push');

    renderDashboard();

    const card = await screen.findByTestId('dashboard-next-workout');
    expect(card).toHaveTextContent(/Pull/);
  });

  it('does not render a muscle visualization', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();

    await screen.findByTestId('dashboard-next-workout');
    expect(screen.queryByTestId('dashboard-muscle-visualization')).toBeNull();
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

  it('labels the secondary action "Change Workout"', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-change-split')).toHaveTextContent('Change Workout');
  });

  it('labels the primary action "Start Workout", generically (not day-specific)', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-start-next-workout')).toHaveTextContent(
      /Start Workout/,
    );
    expect(screen.getByTestId('dashboard-start-next-workout')).not.toHaveTextContent(/Push/);
  });

  it("shows a short accent-colored badge derived from the split's own name", async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(ppl);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-next-workout-badge')).toHaveTextContent('PH');
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

describe('DashboardScreen stat grid', () => {
  function historicalSet(overrides: Partial<{ weightKg: number; reps: number }> = {}) {
    return {
      weightKg: 100,
      reps: 5,
      performedAt: '2026-01-01T00:00:00Z',
      workoutExerciseId: 'we1',
      exerciseId: 'ex-bench',
      exerciseName: 'Bench Press',
      muscleGroup: 'chest' as const,
      ...overrides,
    };
  }

  function completedWorkout(id: string, performedAt = '2026-01-01T00:00:00Z') {
    return {
      id,
      name: 'Push Day',
      performedAt,
      completedAt: performedAt,
      workoutSplitDayId: null,
    };
  }

  it('shows Sets Done (All Time) from the real set history', async () => {
    mockFetchAllExerciseHistory.mockResolvedValue([historicalSet(), historicalSet()]);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-stat-sets')).toHaveTextContent(/2/);
    expect(screen.getByTestId('dashboard-stat-sets')).toHaveTextContent(/Sets Done/);
  });

  it('shows Workouts (This Month) from real lifetime stats', async () => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    mockFetchAllCompletedWorkouts.mockResolvedValue([completedWorkout('w1', thisMonth)]);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-stat-workouts-month')).toHaveTextContent(/1/);
  });

  // Progresso has no step-tracking data source (no HealthKit/Health Connect
  // integration) -- this tile is an honest placeholder, the same pattern as
  // the Nutrition mode's "Weekly Calories" card, never a fabricated number.
  it('shows the Steps tile as a placeholder, not a fabricated count', async () => {
    renderDashboard();

    expect(await screen.findByTestId('dashboard-stat-steps')).toHaveTextContent(/Steps/);
    expect(screen.getByTestId('dashboard-stat-steps')).toHaveTextContent(/Not connected/);
  });

  it('no longer shows a Weekly Goal stat', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, workoutFrequencyDays: 4 });

    renderDashboard();
    await screen.findByTestId('dashboard-stat-grid');

    expect(screen.queryByTestId('dashboard-stat-weekly-goal')).toBeNull();
    expect(screen.queryByText('Weekly Goal')).toBeNull();
  });

  describe('Last Workout', () => {
    const recentInfo = {
      workout: {
        id: 'w-last',
        name: 'Pull Day',
        performedAt: '2026-09-18T17:00:00.000Z',
        completedAt: '2026-09-18T17:40:00.000Z',
        workoutSplitDayId: null,
      },
      musclesTrained: 'Back',
      durationMinutes: 40,
      topExerciseName: null,
      topExerciseSets: [],
      previousExerciseSets: [],
      topSet: null,
      prLabel: null,
    };

    it("shows the user's most recent completed workout: its name, title and date", async () => {
      mockFetchRecentWorkoutInfo.mockResolvedValue(recentInfo);

      renderDashboard();

      const cell = await screen.findByTestId('dashboard-stat-last-workout');
      await waitFor(() => expect(cell).toHaveTextContent(/Pull Day/));
      expect(cell).toHaveTextContent(/Last Workout/);
      const date = new Date('2026-09-18T17:00:00.000Z').toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      expect(cell).toHaveTextContent(new RegExp(date.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });

    it('sets the workout name in the regular UI face on one line, never the mono numeric face', async () => {
      mockFetchRecentWorkoutInfo.mockResolvedValue(recentInfo);

      renderDashboard();

      const cell = await screen.findByTestId('dashboard-stat-last-workout');
      const name = await within(cell).findByText('Pull Day');
      expect(String(StyleSheet.flatten(name.props.style).fontFamily)).toMatch(/^Manrope_/);
      expect(name.props.numberOfLines).toBe(1);
    });

    it('opens that workout when tapped, like the Recent Workout card', async () => {
      mockFetchRecentWorkoutInfo.mockResolvedValue(recentInfo);

      renderDashboard();
      const cell = await screen.findByTestId('dashboard-stat-last-workout');
      await waitFor(() => expect(cell).toHaveTextContent(/Pull Day/));
      expect(cell.props.accessibilityRole).toBe('button');

      fireEvent.press(cell);

      expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w-last' });
    });

    it('uses the data already fetched for Recent Workout -- one fetch, not a second one', async () => {
      mockFetchRecentWorkoutInfo.mockResolvedValue(recentInfo);

      renderDashboard();
      await screen.findByTestId('dashboard-recent-workout');

      expect(mockFetchRecentWorkoutInfo).toHaveBeenCalledTimes(1);
      // Both surfaces name the very same workout.
      expect(screen.getByTestId('dashboard-recent-workout-name')).toHaveTextContent('Pull Day');
      expect(screen.getByTestId('dashboard-stat-last-workout')).toHaveTextContent(/Pull Day/);
    });

    it('shows the same "--" empty treatment as Steps, and is not tappable, when there is no completed workout', async () => {
      renderDashboard();

      const cell = await screen.findByTestId('dashboard-stat-last-workout');
      expect(cell).toHaveTextContent(/--/);
      expect(cell).toHaveTextContent(/Last Workout/);
      expect(cell).toHaveTextContent(/No workouts yet/);
      expect(cell.props.accessibilityRole).not.toBe('button');
      fireEvent.press(cell);
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  it('navigates to Progress when the Sets Done or Workouts This Month tile is pressed', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-stat-sets');

    fireEvent.press(screen.getByTestId('dashboard-stat-sets'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgressOverview');
  });

  it('shows an error without blocking the rest of the dashboard when the stats fetch fails', async () => {
    mockFetchAllCompletedWorkouts.mockRejectedValue(new Error('Network down'));
    mockFetchAllExerciseHistory.mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-stats-error')).toHaveTextContent('Network down');
    expect(screen.getByTestId('dashboard-stat-grid')).toBeTruthy();
  });
});

describe('DashboardScreen Weekly Process widget', () => {
  // Wednesday, so the week has a real mix of past (Mon/Tue), current (Wed),
  // and future (Thu-Sun) days to exercise the rest-day logic below.
  const wednesday = new Date('2026-09-09T12:00:00');

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(wednesday);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('labels the widget "This week" and marks days with a completed workout', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, workoutFrequencyDays: 5 });
    const { start: monday } = getCurrentWeekRange(wednesday);
    mockFetchWorkoutsForDateRange.mockResolvedValue([
      {
        id: 'w1',
        name: 'Push Day',
        performedAt: monday.toISOString(),
        completedAt: monday.toISOString(),
        workoutSplitDayId: null,
      },
    ]);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-weekly-count')).toHaveTextContent('This week');
    expect(screen.getByLabelText('Mon, completed')).toBeTruthy();
  });

  // Regression coverage: a past day with no workout used to read as "not
  // completed" -- indistinguishable from a genuine miss. It's now
  // auto-treated as a rest day (computed on the fly, never persisted -- see
  // weeklyProgress.ts's isRestDay), while today and future days, which
  // simply haven't happened yet, are left as plain "not completed".
  it('shows a past day with no workout as a rest day, but leaves today and future days as plain "not completed"', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, workoutFrequencyDays: 5 });
    mockFetchWorkoutsForDateRange.mockResolvedValue([]);

    renderDashboard();

    await screen.findByTestId('dashboard-weekly-count');
    expect(screen.getByLabelText('Tue, rest day')).toBeTruthy();
    expect(screen.getByLabelText('Wed, not completed')).toBeTruthy();
    expect(screen.getByLabelText('Thu, not completed')).toBeTruthy();
  });

  it('still labels the widget "This week" when the profile has no workout-frequency goal set', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, workoutFrequencyDays: null });
    mockFetchWorkoutsForDateRange.mockResolvedValue([]);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-weekly-count')).toHaveTextContent('This week');
  });

  it('shows an error without blocking the rest of the dashboard when the weekly fetch fails', async () => {
    mockFetchWorkoutsForDateRange.mockRejectedValue(new Error('Network down'));

    renderDashboard();

    expect(await screen.findByTestId('dashboard-weekly-error')).toHaveTextContent('Network down');
    expect(screen.getByTestId('dashboard-weekly-progress')).toBeTruthy();
  });

  it('navigates to WorkoutHistory when "View Details" is pressed', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-weekly-progress');

    fireEvent.press(screen.getByTestId('dashboard-weekly-view-details'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutHistory');
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
    await screen.findByTestId('dashboard-screen');

    fireEvent.press(screen.getByTestId('dashboard-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalled();
  });

  it('remains reachable after switching to Nutrition mode', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');
    fireEvent.press(screen.getByTestId('dashboard-open-menu'));

    expect(mockOpenMenu).toHaveBeenCalled();
  });
});

describe('DashboardScreen widget spacing', () => {
  it('defines the widget gap as exactly 6px and uses that one token for every widget-to-widget gap', () => {
    expect(widgetGap).toBe(6);
    // Widget-to-widget spacing lives on the stack, once. (Inside a card, groups
    // are separated by hairlines, not gaps -- see the Dashboard composition tests.)
    expect(dashboardStyles.widgetStack.gap).toBe(widgetGap);
  });

  it('spaces Workout mode widgets by the widget gap, with no per-widget outer margin', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-screen');

    const stackStyle = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-scroll').props.contentContainerStyle].flat(),
    );
    expect(stackStyle.gap).toBe(widgetGap);

    // The gap lives on the container; no widget adds its own margin on top.
    for (const testID of [
      'dashboard-next-workout',
      'dashboard-start-workout',
      'dashboard-activity',
    ]) {
      const node = screen.queryByTestId(testID);
      if (!node) continue;
      const style = Object.assign({}, ...[node.props.style].flat(Infinity));
      expect(style.marginTop ?? 0).toBe(0);
      expect(style.marginBottom ?? 0).toBe(0);
    }
  });

  it('spaces Nutrition mode widgets by the widget gap, with no per-widget outer margin', async () => {
    renderDashboard('nutrition');
    await screen.findByTestId('dashboard-nutrition');

    const areaStyle = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-nutrition-content').props.contentContainerStyle].flat(
        Infinity,
      ),
    );
    expect(areaStyle.gap).toBe(widgetGap);

    for (const testID of [
      'dashboard-nutrition-hero-section',
      'dashboard-nutrition-quick-actions-section',
      'dashboard-nutrition-meals-section',
    ]) {
      const style = Object.assign({}, ...[screen.getByTestId(testID).props.style].flat(Infinity));
      expect(style.marginTop ?? 0).toBe(0);
      expect(style.marginBottom ?? 0).toBe(0);
    }
  });
});

describe('DashboardScreen Recent Workout card', () => {
  const recentInfo = {
    workout: {
      id: 'w-recent',
      name: 'Push Day',
      performedAt: '2026-09-18T17:00:00.000Z',
      completedAt: '2026-09-18T17:52:00.000Z',
      workoutSplitDayId: null,
    },
    musclesTrained: 'Chest, Triceps',
    durationMinutes: 52,
    topExerciseName: 'Bench Press',
    topExerciseSets: [],
    previousExerciseSets: [],
    topSet: {
      id: 's1',
      setIndex: 1,
      weightKg: 100,
      reps: 5,
      completedAt: '2026-09-18T17:30:00.000Z',
      side: 'none',
    },
    prLabel: '5 Rep PR',
  };

  it("shows the user's real most recent workout: name, duration, muscles, top set, and PR", async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue(recentInfo);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-recent-workout')).toBeTruthy();
    expect(screen.getByTestId('dashboard-recent-workout-name')).toHaveTextContent('Push Day');
    expect(screen.getByTestId('dashboard-recent-workout-meta')).toHaveTextContent(
      '52 min · Chest, Triceps',
    );
    expect(screen.getByTestId('dashboard-recent-workout-top-set')).toHaveTextContent(
      'Bench Press · 100kg × 5',
    );
    expect(screen.getByTestId('dashboard-recent-workout-pr')).toHaveTextContent('5 Rep PR');
  });

  it("shows the top set in the user's own weight unit", async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, weightUnit: 'lb' as const });
    mockFetchRecentWorkoutInfo.mockResolvedValue(recentInfo);

    renderDashboard();

    expect(await screen.findByTestId('dashboard-recent-workout-top-set')).toHaveTextContent(
      'Bench Press · 220.46lb × 5',
    );
  });

  it('omits the PR badge when the top set is not currently a record', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue({ ...recentInfo, prLabel: null });

    renderDashboard();

    await screen.findByTestId('dashboard-recent-workout-top-set');
    expect(screen.queryByTestId('dashboard-recent-workout-pr')).toBeNull();
  });

  it('omits missing pieces instead of showing placeholders when there is no duration or top set', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue({
      ...recentInfo,
      durationMinutes: null,
      topSet: null,
      topExerciseName: null,
      prLabel: null,
    });

    renderDashboard();

    expect(await screen.findByTestId('dashboard-recent-workout-meta')).toHaveTextContent(
      /^Chest, Triceps$/,
    );
    expect(screen.queryByTestId('dashboard-recent-workout-top-set')).toBeNull();
  });

  it('opens that workout when the card is pressed', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue(recentInfo);

    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-recent-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w-recent' });
  });

  it('is announced as a button describing which workout it opens', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue(recentInfo);

    renderDashboard();

    const card = await screen.findByTestId('dashboard-recent-workout');
    expect(card.props.accessibilityRole).toBe('button');
    expect(card.props.accessibilityLabel).toMatch(/Recent workout, Push Day/);
  });

  it('renders nothing (no placeholder card) when the user has no completed workout yet', async () => {
    renderDashboard();

    await screen.findByTestId('dashboard-screen');
    expect(screen.queryByTestId('dashboard-recent-workout')).toBeNull();
    expect(screen.queryByTestId('dashboard-recent-workout-section')).toBeNull();
  });

  it('shows an error for this section without breaking the rest of the dashboard', async () => {
    mockFetchRecentWorkoutInfo.mockRejectedValue(new Error('recent down'));

    renderDashboard();

    expect(await screen.findByTestId('dashboard-recent-workout-error')).toHaveTextContent(
      'recent down',
    );
    expect(screen.getByTestId('dashboard-weekly-progress')).toBeTruthy();
    expect(screen.getByTestId('dashboard-stat-grid')).toBeTruthy();
  });

  it('is a Workout-mode widget only', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue(recentInfo);

    renderDashboard('nutrition');

    await screen.findByTestId('dashboard-nutrition');
    expect(screen.queryByTestId('dashboard-recent-workout')).toBeNull();
  });
});

describe('DashboardScreen calories left', () => {
  const log = {
    id: 'l1',
    foodId: 'f1',
    foodNameSnapshot: 'Chicken',
    servingSize: 100,
    servingUnit: 'g',
    quantity: 1,
    calories: 500,
    proteinG: 31,
    carbsG: 0,
    fatG: 3.6,
    loggedAt: '2026-01-01T12:00:00Z',
  };

  it('shows how many calories are left today, from the real goal and logged food', async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2000,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    mockFetchTodaysFoodLogs.mockResolvedValue([log]);

    renderDashboard('nutrition');

    expect(await screen.findByTestId('dashboard-calories-remaining')).toHaveTextContent(
      '1,500 kcal left',
    );
  });

  it('says how far over the goal the user is once they exceed it', async () => {
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 400,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });
    mockFetchTodaysFoodLogs.mockResolvedValue([log]);

    renderDashboard('nutrition');

    expect(await screen.findByTestId('dashboard-calories-remaining')).toHaveTextContent(
      '100 kcal over',
    );
  });

  it('shows nothing (never a made-up number) when no calorie goal is set', async () => {
    renderDashboard('nutrition');

    await screen.findByTestId('dashboard-nutrition');
    expect(screen.queryByTestId('dashboard-calories-remaining')).toBeNull();
  });
});

describe('DashboardScreen composition: a few purposeful surfaces, not a pile of cards', () => {
  const nextPlan = {
    id: 'split-1',
    name: 'PPL - Hypertrophy',
    days: [{ id: 'day-push', name: 'Push', orderIndex: 1, muscleGroups: ['chest', 'triceps'] }],
  };

  async function renderWithNextWorkout() {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, activeWorkoutSplitId: 'split-1' });
    mockFetchWorkoutSplitDetail.mockResolvedValue(nextPlan);
    mockFetchLastWorkoutSplitDayId.mockResolvedValue(null);
    renderDashboard();
    await screen.findByTestId('dashboard-next-workout');
  }

  it('Workout Home is three surfaces at most: Next Workout, one Activity card, and Recent Workout', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue({
      workout: {
        id: 'w1',
        name: 'Pull Day',
        performedAt: '2026-09-18T17:00:00.000Z',
        completedAt: '2026-09-18T17:40:00.000Z',
        workoutSplitDayId: null,
      },
      musclesTrained: 'Back',
      durationMinutes: 40,
      topExerciseName: null,
      topExerciseSets: [],
      previousExerciseSets: [],
      topSet: null,
      prLabel: null,
    });
    await renderWithNextWorkout();
    await screen.findByTestId('dashboard-recent-workout');

    expect(screen.UNSAFE_getAllByType(AppCard)).toHaveLength(3);
  });

  it('holds this week and all four stats in ONE activity card, with no card per stat', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-activity');

    const activity = within(screen.getByTestId('dashboard-activity'));
    expect(activity.getByTestId('dashboard-weekly-progress')).toBeTruthy();
    for (const id of [
      'dashboard-stat-sets',
      'dashboard-stat-workouts-month',
      'dashboard-stat-steps',
      'dashboard-stat-last-workout',
    ]) {
      expect(activity.getByTestId(id)).toBeTruthy();
    }
    // A stat is a quiet block inside the card -- not a card of its own.
    expect(
      within(screen.getByTestId('dashboard-activity')).UNSAFE_queryAllByType(AppCard),
    ).toHaveLength(0);
    const cell = StyleSheet.flatten(screen.getByTestId('dashboard-stat-sets').props.style);
    expect(cell.borderWidth).toBeUndefined();
    expect(cell.backgroundColor).toBe(colors.surfaceRaised);
  });

  it('shows no decorative icon tile on the stats -- the number leads', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-activity');

    expect(
      within(screen.getByTestId('dashboard-stat-grid')).UNSAFE_queryAllByType(Feather),
    ).toHaveLength(0);
  });

  it('keeps every stat that navigates announced as a button naming its whole content', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-activity');

    const sets = screen.getByTestId('dashboard-stat-sets');
    expect(sets.props.accessibilityRole).toBe('button');
    expect(sets.props.accessibilityLabel).toBe('Sets Done, 0, All Time');
    // Steps has nothing behind it yet, so it is not a button.
    expect(screen.getByTestId('dashboard-stat-steps').props.accessibilityRole).not.toBe('button');
  });

  it('uses the shared PrimaryButton (in the mode accent) and a quiet TextButton on the Next Workout card', async () => {
    await renderWithNextWorkout();

    const start = screen.getByTestId('dashboard-start-next-workout');
    expect(start.props.accessibilityRole).toBe('button');
    expect(StyleSheet.flatten(start.props.style).backgroundColor).toBe(
      DEFAULT_WORKOUT_THEME.accent,
    );
    expect(StyleSheet.flatten(start.props.style).minHeight).toBeGreaterThanOrEqual(44);

    const change = screen.getByTestId('dashboard-change-split');
    expect(change.props.accessibilityRole).toBe('button');
    expect(change).toHaveTextContent(/Change Workout/);
    // The secondary action is text, not a second filled/bordered button.
    expect(StyleSheet.flatten(change.props.style).backgroundColor).toBeUndefined();
    expect(StyleSheet.flatten(change.props.style).borderWidth).toBeUndefined();
  });

  it('shows the split badge through the shared Badge, with its real text', async () => {
    await renderWithNextWorkout();

    // The badge is the split's initials (see splitBadgeText): "PPL - Hypertrophy" -> "PH".
    expect(screen.getByTestId('dashboard-next-workout-badge')).toHaveTextContent(/^PH$/);
  });

  it('Nutrition quick actions are ONE card holding three actions, not three cards', async () => {
    renderDashboard('nutrition');
    await screen.findByTestId('dashboard-nutrition');

    const section = within(screen.getByTestId('dashboard-nutrition-quick-actions-section'));
    expect(section.UNSAFE_getAllByType(AppCard)).toHaveLength(1);
    for (const id of ['dashboard-quick-search', 'dashboard-quick-add', 'dashboard-quick-scan']) {
      expect(section.getByTestId(id)).toBeTruthy();
    }
  });

  it('names the quick actions by what they do, and leaves out the marketing subtitles', async () => {
    renderDashboard('nutrition');
    await screen.findByTestId('dashboard-nutrition');

    expect(screen.getByTestId('dashboard-quick-search')).toHaveTextContent(/Search Food/);
    expect(screen.getByTestId('dashboard-quick-scan')).toHaveTextContent(/Scan Barcode/);
    expect(screen.queryByText('Find and log food')).toBeNull();
    expect(screen.queryByText('Log in seconds')).toBeNull();
  });

  it('does not present Quick Add (no action behind it yet) as a button', async () => {
    renderDashboard('nutrition');
    await screen.findByTestId('dashboard-nutrition');

    expect(screen.getByTestId('dashboard-quick-add').props.accessibilityRole).not.toBe('button');
    fireEvent.press(screen.getByTestId('dashboard-quick-add'));
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('dashboard-quick-search').props.accessibilityRole).toBe('button');
  });

  it("shows up to four of today's meals as list rows, most recent handful only", async () => {
    mockFetchTodaysFoodLogs.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => ({
        id: `l${i}`,
        foodId: `f${i}`,
        foodNameSnapshot: `Food ${i}`,
        servingSize: 100,
        servingUnit: 'g',
        quantity: 1,
        calories: 100 + i,
        proteinG: 1,
        carbsG: 1,
        fatG: 1,
        loggedAt: '2026-01-01T12:00:00Z',
      })),
    );
    renderDashboard('nutrition');
    await screen.findByTestId('dashboard-todays-meals');

    expect(screen.getByText('Food 0')).toBeTruthy();
    expect(screen.getByText('Food 3')).toBeTruthy();
    expect(screen.queryByText('Food 4')).toBeNull();
    expect(screen.getByText('100 kcal')).toBeTruthy();
    // The header row is still the way into the full list.
    expect(screen.getByTestId('dashboard-view-meals').props.accessibilityRole).toBe('button');
  });

  it('never nests a card inside another card on either mode', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-activity');
    for (const card of screen.UNSAFE_getAllByType(AppCard)) {
      // (within(card) includes the card itself, so 1 means nothing nested inside.)
      expect(within(card).UNSAFE_queryAllByType(AppCard)).toHaveLength(1);
    }

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');
    for (const card of screen.UNSAFE_getAllByType(AppCard)) {
      // (within(card) includes the card itself, so 1 means nothing nested inside.)
      expect(within(card).UNSAFE_queryAllByType(AppCard)).toHaveLength(1);
    }
  });
});

describe('DashboardScreen Activity stat blocks: exactly 6px apart, one cohesive card', () => {
  const flat = (testID: string) =>
    Object.assign({}, ...[screen.getByTestId(testID).props.style].flat(Infinity));

  it('separates the four stat blocks by exactly the 6px widget gap, both between rows and within a row', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-stat-grid');

    // Between the two rows.
    expect(flat('dashboard-stat-grid').gap).toBe(widgetGap);
    expect(widgetGap).toBe(6);
    // Between the two blocks in a row: each row is a flex row with the same gap.
    const grid = screen.getByTestId('dashboard-stat-grid');
    const rows = grid.children as unknown as { props: { style: unknown } }[];
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      const style = Object.assign({}, ...[row.props.style].flat(Infinity));
      expect(style.flexDirection).toBe('row');
      expect(style.gap).toBe(widgetGap);
    }
  });

  it('draws no hairline dividers between the blocks -- the gap is the separation', () => {
    for (const removed of ['statCellDivider', 'statRowDivider', 'activityDivider']) {
      expect(removed in dashboardStyles).toBe(false);
    }
  });

  it('gives each block a quiet raised fill and the control radius, with no border or margin', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-stat-grid');

    for (const id of [
      'dashboard-stat-sets',
      'dashboard-stat-workouts-month',
      'dashboard-stat-steps',
      'dashboard-stat-last-workout',
    ]) {
      const style = flat(id);
      expect(style.backgroundColor).toBe(colors.surfaceRaised);
      expect(style.borderRadius).toBe(radii.md);
      expect(style.borderWidth).toBeUndefined();
      expect(style.margin).toBeUndefined();
      expect(style.marginLeft).toBeUndefined();
      expect(style.marginTop).toBeUndefined();
    }
  });

  it('shows the four blocks in order -- Sets Done and Workouts, then Steps and Last Workout -- in two rows', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-stat-grid');

    const blocks = within(screen.getByTestId('dashboard-stat-grid')).UNSAFE_getAllByType(
      DashboardStat,
    );
    expect(blocks.map((block) => block.props.testID)).toEqual([
      'dashboard-stat-sets',
      'dashboard-stat-workouts-month',
      'dashboard-stat-steps',
      'dashboard-stat-last-workout',
    ]);
  });

  it('keeps the blocks inside the single Activity card, with no extra border or icon', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-activity');

    const activity = within(screen.getByTestId('dashboard-activity'));
    expect(activity.getByTestId('dashboard-stat-grid')).toBeTruthy();
    // Nothing nested inside it: the blocks are not cards.
    expect(activity.UNSAFE_queryAllByType(AppCard)).toHaveLength(0);
    expect(
      within(screen.getByTestId('dashboard-stat-grid')).UNSAFE_queryAllByType(Feather),
    ).toHaveLength(0);
  });
});

describe('DashboardScreen renders no bare text outside <Text>', () => {
  it('has no string directly inside a View in Workout mode', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-stat-grid');

    expectNoBareText();
  });

  it('has no string directly inside a View in Nutrition mode', async () => {
    renderDashboard('nutrition');
    await screen.findByTestId('dashboard-nutrition-content');

    expectNoBareText();
  });
});
