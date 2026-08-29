import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchRecentWorkoutInfo } from '../dashboard/recentWorkoutInfo';
import { getMyProfile } from '../lib/api';
import { fetchTodaysFoodLogs } from '../nutrition/foodLogQueries';
import { fetchNutritionGoals } from '../nutrition/nutritionGoalQueries';
import { fetchActiveWorkout } from '../workouts/workoutQueries';
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

jest.mock('../dashboard/recentWorkoutInfo', () => ({
  fetchRecentWorkoutInfo: jest.fn(),
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
const mockFetchRecentWorkoutInfo = fetchRecentWorkoutInfo as jest.Mock;
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

const baseProfile = {
  id: 'user-1',
  email: 'athlete@example.com',
  role: 'user',
  displayName: 'Harbir',
  username: 'harbir_b',
  weightUnit: 'kg' as const,
};

const recentWorkoutInfo = {
  workout: {
    id: 'w1',
    name: 'Push Day',
    performedAt: '2026-01-01T10:00:00Z',
    completedAt: '2026-01-01T11:00:00Z',
  },
  musclesTrained: 'Chest, Shoulders',
  durationMinutes: 60,
  topExerciseName: 'Bench Press',
  topExerciseSets: [{ id: 's1', setIndex: 1, weightKg: 110, reps: 8 }],
  previousExerciseSets: [{ id: 'p1', setIndex: 1, weightKg: 100, reps: 8 }],
  topSet: { id: 's1', setIndex: 1, weightKg: 110, reps: 8 },
  prLabel: null as string | null,
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-123' },
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockFetchActiveWorkout.mockReset().mockResolvedValue(null);
  mockFetchRecentWorkoutInfo.mockReset().mockResolvedValue(null);
  mockFetchTodaysFoodLogs.mockReset().mockResolvedValue([]);
  mockFetchNutritionGoals.mockReset().mockResolvedValue({
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  });
  mockNavigate.mockClear();
});

describe('DashboardScreen loading/greeting', () => {
  it('shows a loading indicator while fetching', async () => {
    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(screen.getByTestId('dashboard-loading')).toBeTruthy();

    await screen.findByTestId('dashboard-greeting');
  });

  it('greets with the display name', async () => {
    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-greeting')).toHaveTextContent(/, Harbir$/);
  });

  it('falls back to username when displayName is unset', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, displayName: null });

    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-greeting')).toHaveTextContent(/, harbir_b$/);
  });

  it('never greets with the raw email', async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, displayName: null, username: null });

    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-greeting')).not.toHaveTextContent(
      /athlete@example\.com/,
    );
  });

  it('shows a profile error without crashing the rest of the dashboard', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('profile down'));

    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-profile-error')).toHaveTextContent('profile down');
    expect(screen.getByTestId('dashboard-start-workout')).toBeTruthy();
  });
});

describe('DashboardScreen primary workout action', () => {
  it('shows Start Workout when there is no active workout', async () => {
    render(<DashboardScreen navigation={navigation} route={route} />);

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

    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-resume-workout')).toHaveTextContent(/Leg Day/);
    expect(screen.queryByTestId('dashboard-start-workout')).toBeNull();
  });

  it('navigates to NewWorkout when Start Workout is pressed', async () => {
    render(<DashboardScreen navigation={navigation} route={route} />);
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

    render(<DashboardScreen navigation={navigation} route={route} />);
    await screen.findByTestId('dashboard-resume-workout');

    fireEvent.press(screen.getByTestId('dashboard-resume-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('ActiveWorkout', { workoutId: 'active-1' });
  });

  it('shows an active-workout error without hiding the rest of the dashboard', async () => {
    mockFetchActiveWorkout.mockRejectedValue(new Error('network error'));

    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-active-workout-error')).toHaveTextContent(
      'network error',
    );
    expect(screen.getByTestId('dashboard-greeting')).toBeTruthy();
  });
});

describe('DashboardScreen recent workout', () => {
  it('shows a first-workout empty state when there is no completed workout yet', async () => {
    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-recent-workout-empty')).toHaveTextContent(
      'Start your first workout',
    );
  });

  it('displays the recent workout, muscles trained, and duration', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue(recentWorkoutInfo);

    render(<DashboardScreen navigation={navigation} route={route} />);

    const card = await screen.findByTestId('dashboard-recent-workout');
    expect(card).toHaveTextContent(/Push Day/);
    expect(card).toHaveTextContent(/Chest, Shoulders/);
    expect(card).toHaveTextContent(/60 min/);
  });

  it('displays the top set', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue(recentWorkoutInfo);

    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-top-set')).toHaveTextContent(
      /Bench Press: 110kg×8/,
    );
  });

  it('shows a PR label on the top set when it is the current record', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue({ ...recentWorkoutInfo, prLabel: '8 Rep PR' });

    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-top-set')).toHaveTextContent(/8 Rep PR/);
  });

  it('does not show a PR label when the top set is not a current record', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue(recentWorkoutInfo);

    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-top-set')).not.toHaveTextContent(/PR/);
  });

  it('shows a comparison-to-previous insight derived from existing sets', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue(recentWorkoutInfo);

    render(<DashboardScreen navigation={navigation} route={route} />);

    // 110kg beats the previous 100kg at the same 8 reps.
    expect(await screen.findByTestId('dashboard-insight')).toHaveTextContent('+10kg at 8 reps');
  });

  it('shows no insight when there is no previous occurrence to compare against', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue({
      ...recentWorkoutInfo,
      previousExerciseSets: [],
    });

    render(<DashboardScreen navigation={navigation} route={route} />);
    await screen.findByTestId('dashboard-recent-workout');

    expect(screen.queryByTestId('dashboard-insight')).toBeNull();
  });

  it('navigates to WorkoutDetail when the recent workout card is pressed', async () => {
    mockFetchRecentWorkoutInfo.mockResolvedValue(recentWorkoutInfo);

    render(<DashboardScreen navigation={navigation} route={route} />);
    await screen.findByTestId('dashboard-recent-workout');

    fireEvent.press(screen.getByTestId('dashboard-recent-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetail', { workoutId: 'w1' });
  });

  it('navigates to NewWorkout from the first-workout empty state', async () => {
    render(<DashboardScreen navigation={navigation} route={route} />);
    await screen.findByTestId('dashboard-start-first-workout');

    fireEvent.press(screen.getByTestId('dashboard-start-first-workout'));

    expect(mockNavigate).toHaveBeenCalledWith('NewWorkout');
  });

  it('shows a recent-workout error without hiding the nutrition section', async () => {
    mockFetchRecentWorkoutInfo.mockRejectedValue(new Error('workout fetch failed'));

    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-recent-workout-error')).toHaveTextContent(
      'workout fetch failed',
    );
    expect(screen.getByTestId('dashboard-nutrition')).toBeTruthy();
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

    render(<DashboardScreen navigation={navigation} route={route} />);

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

    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-calories')).toHaveTextContent(
      'Calories: 165 / 2000',
    );
    expect(screen.queryByTestId('dashboard-nutrition-no-goals')).toBeNull();
  });

  it('shows an empty (zeroed) snapshot when nothing has been logged today', async () => {
    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-calories')).toHaveTextContent('Calories: 0');
  });

  it('navigates to Nutrition when the snapshot is pressed', async () => {
    render(<DashboardScreen navigation={navigation} route={route} />);
    await screen.findByTestId('dashboard-nutrition');

    fireEvent.press(screen.getByTestId('dashboard-nutrition'));

    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });

  it('shows a nutrition error without hiding workout information', async () => {
    mockFetchTodaysFoodLogs.mockRejectedValue(new Error('nutrition down'));

    render(<DashboardScreen navigation={navigation} route={route} />);

    expect(await screen.findByTestId('dashboard-nutrition-error')).toHaveTextContent(
      'nutrition down',
    );
    expect(screen.getByTestId('dashboard-start-workout')).toBeTruthy();
  });
});

describe('DashboardScreen secondary navigation', () => {
  it('navigates to AccountSettings via the settings affordance', async () => {
    render(<DashboardScreen navigation={navigation} route={route} />);
    await screen.findByTestId('dashboard-greeting');

    fireEvent.press(screen.getByTestId('open-account-settings'));

    expect(mockNavigate).toHaveBeenCalledWith('AccountSettings');
  });

  it('navigates to WorkoutHistory via View All Workouts', async () => {
    render(<DashboardScreen navigation={navigation} route={route} />);
    await screen.findByTestId('dashboard-view-workouts');

    fireEvent.press(screen.getByTestId('dashboard-view-workouts'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutHistory');
  });
});

describe('DashboardScreen partial failure', () => {
  it('still renders workout and nutrition sections when the profile fetch fails', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('profile down'));
    mockFetchRecentWorkoutInfo.mockResolvedValue(recentWorkoutInfo);
    mockFetchNutritionGoals.mockResolvedValue({
      calories: 2000,
      proteinG: null,
      carbsG: null,
      fatG: null,
    });

    render(<DashboardScreen navigation={navigation} route={route} />);

    await waitFor(() => expect(screen.getByTestId('dashboard-profile-error')).toBeTruthy());
    expect(screen.getByTestId('dashboard-recent-workout')).toBeTruthy();
    expect(screen.getByTestId('dashboard-nutrition')).toBeTruthy();
  });

  it('recovers on the next focus after a failed section', async () => {
    mockFetchTodaysFoodLogs.mockRejectedValueOnce(new Error('nutrition down'));

    render(<DashboardScreen navigation={navigation} route={route} />);
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
