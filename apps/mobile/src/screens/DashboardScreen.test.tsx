import { useState, type ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { getCurrentWeekRange } from '../dashboard/weeklyProgress';
import { BackgroundThemeProvider } from '../design/BackgroundThemeContext';
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
import { DashboardScreen } from './DashboardScreen';

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
  mockNavigate.mockClear();
  mockOpenMenu.mockClear();
  mockReportMode.mockClear();
});

describe('DashboardScreen loading/greeting', () => {
  it('shows a loading indicator while fetching', async () => {
    renderDashboard();

    expect(screen.getByTestId('dashboard-loading')).toBeTruthy();

    await screen.findByTestId('dashboard-greeting', {}, { timeout: 5000 });
  });

  it('greets with the display name', async () => {
    renderDashboard();

    expect(await screen.findByTestId('dashboard-greeting')).toHaveTextContent('Harbir');
  });

  it('shows the time-of-day eyebrow above the name', async () => {
    renderDashboard();

    await screen.findByTestId('dashboard-greeting');
    expect(screen.getByTestId('dashboard-greeting-eyebrow')).toBeTruthy();
  });

  it('shows only the first word of a multi-word display name', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, displayName: 'Harbir Bains' });

    renderDashboard();

    expect(await screen.findByTestId('dashboard-greeting')).toHaveTextContent('Harbir');
  });

  it('falls back to username when displayName is unset', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, displayName: null });

    renderDashboard();

    expect(await screen.findByTestId('dashboard-greeting')).toHaveTextContent('harbir_b');
  });

  it('never greets with the raw email', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, displayName: null, username: null });

    renderDashboard();

    expect(await screen.findByTestId('dashboard-greeting')).not.toHaveTextContent(
      /athlete@example\.com/,
    );
  });

  it('shows no profile picture or avatar on the main dashboard', async () => {
    renderDashboard();

    await screen.findByTestId('dashboard-greeting');
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

  it("navigates to Nutrition when Weekly Calories' View All is pressed", async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    fireEvent.press(screen.getByTestId('dashboard-weekly-calories-view-all'));

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

    expect(merged.paddingTop).toBe(180 + 12);
    expect(merged.paddingBottom).toBe(100 + 16);
  });

  it('fills the viewport in Workout mode using a scrollable ScrollView that spreads gaps between its 3 widgets', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    const workoutStyle = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-scroll').props.contentContainerStyle].flat(),
    );
    expect(workoutStyle.flexGrow).toBe(1);
    expect(workoutStyle.justifyContent).toBe('space-between');
  });

  it('renders Nutrition mode as a plain, non-scrolling View (no nested ScrollView / "screen inside a screen")', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    // The architectural fix: Nutrition mode must not contain any
    // ScrollView -- its widgets sit directly in a fixed, non-scrolling
    // View, so vertical scrolling to reach them is structurally
    // impossible rather than merely avoided via flex tricks.
    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
    expect(screen.queryByTestId('dashboard-scroll')).toBeNull();

    const nutritionContent = screen.getByTestId('dashboard-nutrition-content');
    const nutritionStyle = Object.assign({}, ...[nutritionContent.props.style].flat(Infinity));
    expect(nutritionStyle.flex).toBe(1);

    // Switching back to Workout mode must restore its own ScrollView --
    // this pass only removed the ScrollView from Nutrition mode.
    fireEvent.press(screen.getByTestId('dashboard-mode-workout'));
    await screen.findByTestId('dashboard-start-workout');
    expect(screen.UNSAFE_queryAllByType(ScrollView)).toHaveLength(1);
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
    // Still never compressed below its own content and clipped.
    expect(weeklyCard.flexShrink).toBe(0);

    const contentFillStyle = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-weekly-calories-content').props.style].flat(Infinity),
    );
    expect(contentFillStyle.flexGrow).toBeUndefined();
  });

  // Real-device testing kept showing Weekly Calories itself clipped even
  // after repeated spacing trims elsewhere -- guessing exact pixel budgets
  // for "a typical phone" without being able to test on the actual device
  // kept coming up short. The robust fix: Quick Actions, Recent Meals, and
  // the greeting each carry their own flexShrink + minHeight floor, so
  // whichever ones a given device leaves too little room for absorb the
  // shortfall together. The Calorie/Macro ring card is deliberately NOT
  // part of that pool -- CalorieRing draws a fixed-size SVG circle that
  // flexShrink would clip rather than gracefully compress -- so it, like
  // Weekly Calories itself, stays flexShrink: 0 and must fit on its own
  // (reduced) natural size alone.
  it('gives Quick Actions/Recent Meals/the greeting a flexShrink safety net, while the ring card and Weekly Calories stay fixed', async () => {
    renderDashboard();
    fireEvent.press(await screen.findByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    const greetingRowStyle = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-nutrition-greeting-row').props.style].flat(Infinity),
    );
    expect(greetingRowStyle.flexShrink).toBe(1);
    expect(greetingRowStyle.minHeight).toBeGreaterThan(0);

    const heroSectionStyle = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-nutrition-hero-section').props.style].flat(Infinity),
    );
    expect(heroSectionStyle.flexShrink).toBeUndefined();

    const quickActionsSectionStyle = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-nutrition-quick-actions-section').props.style].flat(
        Infinity,
      ),
    );
    expect(quickActionsSectionStyle.flexShrink).toBe(1);
    expect(quickActionsSectionStyle.minHeight).toBeGreaterThan(0);

    const mealsSectionStyle = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-nutrition-meals-section').props.style].flat(Infinity),
    );
    expect(mealsSectionStyle.flexShrink).toBe(1);
    expect(mealsSectionStyle.minHeight).toBeGreaterThan(0);

    const weeklyCardStyle = Object.assign(
      {},
      ...[screen.getByTestId('dashboard-weekly-calories-card').props.style].flat(Infinity),
    );
    expect(weeklyCardStyle.flexShrink).toBe(0);
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

    const calendarIcon = within(
      screen.getByTestId('dashboard-weekly-calories-card'),
    ).UNSAFE_getByProps({ name: 'calendar' });
    expect(calendarIcon.props.color).toBe(DEFAULT_NUTRITION_THEME.accent);
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

  it('shows the Weekly Goal as completed/goal when a workout-frequency goal is set', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, workoutFrequencyDays: 4 });
    const { start: monday } = getCurrentWeekRange();
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

    expect(await screen.findByTestId('dashboard-stat-weekly-goal')).toHaveTextContent(/1\/4/);
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

describe('DashboardScreen bottom bar Workouts/Plus/Profile', () => {
  it('navigates to WorkoutHistory from the bottom bar in Workout mode', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-bottom-workouts'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutHistory');
  });

  it('navigates to FoodLibrary from the bottom bar (now "Food") in Nutrition mode', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-mode-nutrition'));
    await screen.findByTestId('dashboard-nutrition');

    fireEvent.press(screen.getByTestId('dashboard-bottom-workouts'));

    expect(mockNavigate).toHaveBeenCalledWith('FoodLibrary');
  });

  it('navigates to Profile when the Profile item is pressed', async () => {
    renderDashboard();
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('dashboard-bottom-profile'));

    expect(mockNavigate).toHaveBeenCalledWith('Profile');
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
