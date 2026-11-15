import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { recordQuietFailure } from '../lib/sentry';
import { useMembership } from '../membership/useMembership';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { sumDailyTotals } from '../nutrition/nutritionCalculations';
import { useProfile } from '../profile/ProfileProvider';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import { musclesLabel } from '../workouts/nextWorkout';
import { fetchNextWorkout } from '../workouts/nextWorkoutQueries';
import type { WorkoutSummary } from '../workouts/workoutQueries';
import { computeStaleMuscleGroups } from './muscleGroupFreshness';
import { planReminders, type ReminderContext } from './reminderPlan';
import {
  clearReminders,
  notificationsAllowed,
  scheduleReminders,
  showNotificationsInApp,
} from './reminderScheduler';
import { RemindersContext, type RemindersContextValue } from './remindersContext';
import {
  loadReminderSettings,
  saveReminderSettings,
  type ReminderSettings,
} from './reminderSettings';

/** How long after the last change the plan is made -- a burst of logging plans once. */
const PLAN_DELAY_MS = 600;

/** When their latest finished workout was, or null before their first. */
function lastWorkoutAt(workouts: WorkoutSummary[]): string | null {
  let latest: string | null = null;
  for (const workout of workouts) {
    if (workout.completedAt === null) continue;
    if (latest === null || Date.parse(workout.performedAt) > Date.parse(latest)) {
      latest = workout.performedAt;
    }
  }
  return latest;
}

/**
 * The person's reminders (Settings > Notifications), and keeping the phone's scheduled ones in
 * step with the app: the plan (notifications/reminderPlan.ts) is made again from the shared
 * caches -- today's food log and targets, the finished workouts, the membership -- whenever any
 * of them changes, whenever the app comes back to the front, and when a setting changes. The
 * next split day is read (two queries) as it signs in, when a workout is finished or the split
 * changes, and on coming back to the front. Only for someone who said yes to notifications
 * (`pushNotificationsOptIn`) on a phone that allows them; otherwise, and on sign-out, nothing is
 * scheduled. Mounted once, inside the providers (App.tsx).
 */
export function RemindersProvider({ children }: { children: ReactNode }) {
  const { status, user } = useAuth();
  const userId = status === 'signedIn' ? (user?.id ?? null) : null;
  const { profile } = useProfile();
  const { nutrition } = useMembership();
  const { logs, loading: logsLoading } = useFoodLog();
  const { goals } = useNutritionGoals();
  const { allWorkouts, allSetHistory } = useAllTimeStats();

  const [settings, setSettings] = useState<ReminderSettings | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [nextWorkout, setNextWorkout] = useState<ReminderContext['nextWorkout']>(null);
  // Bumped on coming back to the front: the day may have turned over.
  const [wokenAt, setWokenAt] = useState(() => Date.now());

  useEffect(() => {
    showNotificationsInApp();
  }, []);

  useEffect(() => {
    setSettings(null);
    if (!userId) return;
    let current = true;
    void loadReminderSettings(userId).then((loaded) => {
      if (current) setSettings(loaded);
    });
    return () => {
      current = false;
    };
  }, [userId]);

  const refreshAllowed = useCallback(async () => {
    setAllowed(await notificationsAllowed());
  }, []);

  const splitId = profile?.activeWorkoutSplitId ?? null;
  const readNextWorkout = useCallback(async () => {
    if (!userId || !splitId) {
      setNextWorkout(null);
      return;
    }
    try {
      const plan = await fetchNextWorkout(userId, splitId);
      setNextWorkout(plan ? { name: plan.day.name, muscles: musclesLabel(plan.day) } : null);
    } catch (error) {
      recordQuietFailure('notifications.nextWorkout', error);
    }
  }, [userId, splitId]);

  useEffect(() => {
    void refreshAllowed();
  }, [refreshAllowed, userId]);

  // A finished workout moves the split on.
  useEffect(() => {
    void readNextWorkout();
  }, [readNextWorkout, allWorkouts]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void refreshAllowed();
      void readNextWorkout();
      setWokenAt(Date.now());
    });
    return () => subscription.remove();
  }, [refreshAllowed, readNextWorkout]);

  const optedIn = profile?.pushNotificationsOptIn === true;
  const active = userId !== null && optedIn && allowed === true;

  const planTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (planTimer.current) clearTimeout(planTimer.current);
    if (status === 'signedOut' || (userId && profile && allowed !== null && !active)) {
      void clearReminders();
      return;
    }
    if (!active || !settings || logsLoading) return;
    planTimer.current = setTimeout(() => {
      const now = new Date();
      const totals = sumDailyTotals(logs);
      void scheduleReminders(
        planReminders(settings, {
          now,
          nextWorkout,
          lastWorkoutAt: lastWorkoutAt(allWorkouts),
          musclesLastTrained: computeStaleMuscleGroups(allSetHistory, now, 0).map((muscle) => ({
            label: muscle.label,
            at: muscle.lastTrainedAt,
          })),
          nutrition,
          today: {
            logged: logs.length > 0,
            calories: totals.calories,
            proteinG: totals.proteinG,
            calorieTarget: goals?.calories ?? null,
            proteinTarget: goals?.proteinG ?? null,
          },
        }),
      );
    }, PLAN_DELAY_MS);
    return () => {
      if (planTimer.current) clearTimeout(planTimer.current);
    };
  }, [
    status,
    userId,
    profile,
    allowed,
    active,
    settings,
    logs,
    logsLoading,
    goals,
    allWorkouts,
    allSetHistory,
    nextWorkout,
    nutrition,
    wokenAt,
  ]);

  const update = useCallback(
    (next: ReminderSettings) => {
      setSettings(next);
      if (userId) {
        saveReminderSettings(userId, next).catch((error) =>
          recordQuietFailure('notifications.saveSettings', error),
        );
      }
    },
    [userId],
  );

  const value = useMemo<RemindersContextValue>(
    () => ({ settings, update, allowed, refreshAllowed, active }),
    [settings, update, allowed, refreshAllowed, active],
  );

  return <RemindersContext.Provider value={value}>{children}</RemindersContext.Provider>;
}
