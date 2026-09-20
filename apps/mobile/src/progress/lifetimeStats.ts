import type { ExerciseHistoryGroup } from '../workouts/exerciseHistoryGrouping';
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

/**
 * Lifetime training volume (kg) across every logged set this user has ever
 * completed -- same weight x reps definition as workoutSummary.ts's
 * computeTotalVolumeKg (one workout at a time), just summed over the whole
 * history instead. Takes the already-fetched, already-correctly-filtered
 * set list (fetchAllExerciseHistory: completed sets only, excludes
 * cancelled/deleted workouts and never-logged "planned" set rows) rather
 * than querying anything itself.
 */
export function computeLifetimeVolumeKg(sets: { weightKg: number; reps: number }[]): number {
  return sets.reduce((sum, set) => sum + set.weightKg * set.reps, 0);
}

export interface ExerciseVolume {
  exerciseId: string;
  exerciseName: string;
  volumeKg: number;
}

/**
 * Every exercise the user has ever logged, ranked by lifetime total volume
 * (heaviest total first) -- reuses computeLifetimeVolumeKg per exercise
 * rather than a second volume formula. Takes the same groupByExercise
 * output every other per-exercise Progress derivation already takes.
 */
export function rankExercisesByVolume(groups: ExerciseHistoryGroup[]): ExerciseVolume[] {
  return groups
    .map((g) => ({
      exerciseId: g.exerciseId,
      exerciseName: g.exerciseName,
      volumeKg: computeLifetimeVolumeKg(g.sets),
    }))
    .sort((a, b) => b.volumeKg - a.volumeKg);
}
