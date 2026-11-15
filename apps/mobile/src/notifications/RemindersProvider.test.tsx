import { act, render } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../auth/AuthProvider';
import { useMembership } from '../membership/useMembership';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { useProfile } from '../profile/ProfileProvider';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { fetchNextWorkout } from '../workouts/nextWorkoutQueries';
import { RemindersProvider } from './RemindersProvider';
import { forgetScheduledReminders } from './reminderScheduler';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../profile/ProfileProvider', () => ({ useProfile: jest.fn() }));
jest.mock('../membership/useMembership', () => ({ useMembership: jest.fn() }));
jest.mock('../nutrition/FoodLogProvider', () => ({ useFoodLog: jest.fn() }));
jest.mock('../nutrition/NutritionGoalsProvider', () => ({ useNutritionGoals: jest.fn() }));
jest.mock('../progress/AllTimeStatsProvider', () => ({ useAllTimeStats: jest.fn() }));
jest.mock('../workouts/nextWorkoutQueries', () => ({ fetchNextWorkout: jest.fn() }));

// Saturday, November 14, 2026, 10:00 AM.
const NOW = new Date(2026, 10, 14, 10, 0);

function scheduled() {
  return jest
    .mocked(Notifications.scheduleNotificationAsync)
    .mock.calls.map(
      ([request]) => request as { identifier: string; content: { title: string; body: string } },
    );
}

function setUp({
  optedIn = true,
  nutrition = true,
  status = 'signedIn',
}: { optedIn?: boolean; nutrition?: boolean; status?: string } = {}) {
  jest.mocked(useAuth).mockReturnValue({ status, user: { id: 'user-1' } } as never);
  jest.mocked(useProfile).mockReturnValue({
    profile: {
      pushNotificationsOptIn: optedIn,
      workoutFrequencyDays: 7,
      activeWorkoutSplitId: 'split-1',
      displayName: 'Harbir Bains',
    },
  } as never);
  jest.mocked(useMembership).mockReturnValue({ nutrition } as never);
  jest.mocked(useFoodLog).mockReturnValue({
    logs: [{ calories: 900, proteinG: 70, carbsG: 0, fatG: 0 }],
    loading: false,
  } as never);
  jest.mocked(useNutritionGoals).mockReturnValue({
    goals: { calories: 2200, proteinG: 160, carbsG: 200, fatG: 60 },
  } as never);
  // Last trained Thursday the 12th: two days ago, so a nudge is due today.
  jest.mocked(useAllTimeStats).mockReturnValue({
    allWorkouts: [
      { id: 'w1', performedAt: '2026-11-12T18:00:00', completedAt: '2026-11-12T19:00:00' },
    ],
    allSetHistory: [{ muscleGroup: 'chest', performedAt: '2026-11-12T18:00:00' }],
  } as never);
}

async function renderProvider() {
  render(<RemindersProvider>{null}</RemindersProvider>);
  // Settings and permission read, and the next workout; then the plan a moment later -- its wait
  // starts as those reads land, at the end of the first act.
  await act(async () => {
    await jest.advanceTimersByTimeAsync(100);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(NOW);
  jest.clearAllMocks();
  forgetScheduledReminders();
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([]);
  jest.mocked(fetchNextWorkout).mockResolvedValue({
    splitId: 'split-1',
    splitName: 'PPL',
    day: { id: 'd1', name: 'Push Day', orderIndex: 0, muscleGroups: ['chest', 'shoulders'] },
    previousDayName: null,
  } as never);
});

afterEach(() => {
  jest.useRealTimers();
});

it("schedules the week's reminders from what the app knows: what's up next, today's food", async () => {
  setUp();
  await renderProvider();

  const requests = scheduled();
  const today = (kind: string) =>
    requests.find((request) => request.identifier === `progresso-reminder-${kind}-2026-11-14`);
  // Two days since the last workout: what's up next in the split.
  expect(today('workout')?.content.title).toBe('Up next: Push Day');
  // Something is logged today: no meal reminder, and the check-in has the day's figures.
  expect(today('meals')).toBeUndefined();
  expect(today('checkIn')?.content.body).toBe(
    '900 of 2,200 calories and 70 of 160 g protein so far today. 90 g of protein to go.',
  );
  expect(Notifications.setNotificationHandler).toHaveBeenCalled();
});

it('schedules no nutrition reminders without Nutrition in the membership', async () => {
  setUp({ nutrition: false });
  await renderProvider();

  expect(scheduled().some((request) => /meals|checkIn/.test(request.identifier))).toBe(false);
  expect(scheduled().length).toBeGreaterThan(0);
});

it('schedules nothing, and clears what was there, for someone who said no to notifications', async () => {
  setUp({ optedIn: false });
  jest
    .mocked(Notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValue([{ identifier: 'progresso-reminder-workout-2026-11-14' }] as never);
  await renderProvider();

  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    'progresso-reminder-workout-2026-11-14',
  );
});

it("schedules nothing where the phone doesn't allow notifications", async () => {
  setUp();
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);
  await renderProvider();

  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('clears the reminders on sign-out', async () => {
  setUp({ status: 'signedOut' });
  jest
    .mocked(Notifications.getAllScheduledNotificationsAsync)
    .mockResolvedValue([{ identifier: 'progresso-reminder-meals-2026-11-15' }] as never);
  await renderProvider();

  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
    'progresso-reminder-meals-2026-11-15',
  );
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});
