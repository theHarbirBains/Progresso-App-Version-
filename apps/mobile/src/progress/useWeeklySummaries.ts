import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { fetchFoodLogsForRange } from '../nutrition/foodLogQueries';
import { useNutritionGoals } from '../nutrition/NutritionGoalsProvider';
import { useProfile } from '../profile/ProfileProvider';
import {
  COMPARISON_WEEKS,
  computeWeeklySummary,
  weekRange,
  type SummaryFoodLog,
  type SummarySet,
  type SummaryWorkout,
  type WeeklySummary,
} from './weeklySummary';
import { fetchSummaryTraining } from './weeklySummaryQueries';

export interface WeekSummaries {
  thisWeek: { range: { start: Date; end: Date }; summary: WeeklySummary };
  lastWeek: { range: { start: Date; end: Date }; summary: WeeklySummary };
}

interface Loaded {
  workouts: SummaryWorkout[];
  sets: SummarySet[];
  foodLogs: SummaryFoodLog[];
}

/**
 * This week's and last week's summaries for Progress. Read once when Progress opens -- it opens
 * fresh on every visit, so a workout or a food logged elsewhere shows the next time -- in two
 * reads: the workouts and sets from COMPARISON_WEEKS before last week to now, and both weeks'
 * food logs. The targets and the weekly workout goal come from what's already loaded.
 */
export function useWeeklySummaries(now: Date = new Date()): {
  summaries: WeekSummaries | null;
  error: string | null;
} {
  const { user } = useAuth();
  const userId = user?.id;
  const { goals } = useNutritionGoals();
  const { profile } = useProfile();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The weeks are fixed when Progress opens.
  const [weeks] = useState(() => ({ thisWeek: weekRange(now), lastWeek: weekRange(now, 1) }));

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const { thisWeek, lastWeek } = weeks;
    const since = new Date(
      lastWeek.start.getFullYear(),
      lastWeek.start.getMonth(),
      lastWeek.start.getDate() - COMPARISON_WEEKS * 7,
    );
    Promise.all([
      fetchSummaryTraining(userId, since, thisWeek.end),
      fetchFoodLogsForRange(userId, lastWeek.start, thisWeek.end),
    ])
      .then(([training, logs]) => {
        if (cancelled) return;
        setLoaded({
          ...training,
          foodLogs: logs.map((log) => ({
            loggedAt: log.loggedAt,
            calories: log.calories,
            proteinG: log.proteinG,
          })),
        });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load the week');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, weeks]);

  const summaries = useMemo(() => {
    if (!loaded) return null;
    const shared = {
      ...loaded,
      dailyCalorieTarget: goals?.calories ?? null,
      dailyProteinTarget: goals?.proteinG ?? null,
      weeklyWorkoutGoal: profile?.workoutFrequencyDays ?? null,
    };
    return {
      thisWeek: {
        range: weeks.thisWeek,
        summary: computeWeeklySummary({ ...shared, week: weeks.thisWeek }),
      },
      lastWeek: {
        range: weeks.lastWeek,
        summary: computeWeeklySummary({ ...shared, week: weeks.lastWeek }),
      },
    };
  }, [loaded, goals, profile, weeks]);

  return { summaries, error };
}
