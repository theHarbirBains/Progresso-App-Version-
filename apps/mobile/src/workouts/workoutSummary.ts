import { fromKg, snapToWeightStep } from '../lib/units';
import { completedSetsOnly } from './setCompletion';
import type { WorkoutExerciseWithSets } from './workoutQueries';

// Pure derivations over data already fetched via fetchWorkoutDetail -- no
// new backend query, no new volume definition. Total Sets counts every set
// row that exists (planned or logged) since that's "the actual sets in the
// current workout"; Total Volume only sums sets that have actually been
// logged, using the same weight x reps definition already established by
// ChartPointDetail/exerciseProgress.ts.

export function computeTotalSets(exercises: WorkoutExerciseWithSets[]): number {
  return exercises.reduce((sum, exercise) => sum + exercise.sets.length, 0);
}

/** One set's own volume (weight x reps) -- the single authoritative
 * definition every other volume calculation in the app (lifetime,
 * per-muscle-group, weekly, milestone thresholds) is built from, rather
 * than each re-deriving `weightKg * reps` independently. */
export function setVolumeKg(set: { weightKg: number; reps: number }): number {
  return set.weightKg * set.reps;
}

/**
 * Volume in the user's display unit: each set's weight snapped to its entry
 * step (snapToWeightStep), times reps, summed. For real entries the result is
 * always a multiple of the step, never a storage rounding artifact like
 * 3149.9 lb.
 */
export function volumeInUnit(
  sets: { weightKg: number; reps: number }[],
  unit: 'kg' | 'lb',
): number {
  return sets.reduce(
    (sum, set) => sum + snapToWeightStep(fromKg(set.weightKg, unit)) * set.reps,
    0,
  );
}

/** A volume as a multiple of the entry step: "3,150", "3,150.5" or "3,150.25". */
export function formatVolume(value: number): string {
  return snapToWeightStep(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function computeTotalVolumeKg(exercises: WorkoutExerciseWithSets[]): number {
  return exercises.reduce((sum, exercise) => {
    const logged = completedSetsOnly(exercise.sets);
    return sum + logged.reduce((setSum, set) => setSum + setVolumeKg(set), 0);
  }, 0);
}
