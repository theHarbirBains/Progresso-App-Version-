import type { WorkoutSummary } from '../workouts/workoutQueries';

// Pure aggregation over already-fetched, real workout history -- no query of
// its own, mirroring the same pattern as exerciseProgress.ts/
// muscleGroupProgress.ts. Duration is workouts.completed_at minus
// performed_at, the same formula workoutHistoryEnrichment.ts/
// recentWorkoutInfo.ts/shareCardData.ts each already compute privately.

export interface LifetimeStats {
  totalWorkouts: number;
  totalMinutes: number;
  workoutsThisMonth: number;
  /** Rounded to one decimal place -- total workouts divided by weeks since the first one, floored at one week so a brand-new account never divides by (near) zero. */
  avgWorkoutsPerWeek: number;
  firstWorkoutAt: string | null;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function computeDurationMinutes(performedAt: string, completedAt: string | null): number {
  if (!completedAt) return 0;
  const ms = new Date(completedAt).getTime() - new Date(performedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.round(ms / 60000);
}

export function computeLifetimeStats(
  workouts: WorkoutSummary[],
  now: Date = new Date(),
): LifetimeStats {
  const totalWorkouts = workouts.length;
  const totalMinutes = workouts.reduce(
    (sum, w) => sum + computeDurationMinutes(w.performedAt, w.completedAt),
    0,
  );
  const firstWorkoutAt = workouts[0]?.performedAt ?? null;

  const workoutsThisMonth = workouts.filter((w) => {
    const d = new Date(w.performedAt);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  let avgWorkoutsPerWeek = 0;
  if (firstWorkoutAt && totalWorkouts > 0) {
    const weeksElapsed = Math.max(
      1,
      (now.getTime() - new Date(firstWorkoutAt).getTime()) / MS_PER_WEEK,
    );
    avgWorkoutsPerWeek = Math.round((totalWorkouts / weeksElapsed) * 10) / 10;
  }

  return { totalWorkouts, totalMinutes, workoutsThisMonth, avgWorkoutsPerWeek, firstWorkoutAt };
}

/** The earliest achievedAt across every rep PR and true 1RM this user has -- "First PR", whichever kind of record it was. */
export function computeFirstPRAt(achievedAtDates: string[]): string | null {
  if (achievedAtDates.length === 0) return null;
  return achievedAtDates.reduce((earliest, d) =>
    new Date(d).getTime() < new Date(earliest).getTime() ? d : earliest,
  );
}
