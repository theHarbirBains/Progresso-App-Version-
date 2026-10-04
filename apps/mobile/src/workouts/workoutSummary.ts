import { fromKg } from '../lib/units';
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
 * Every weight a user can enter is a whole number or a .5 in its own unit
 * (isValidWeightIncrement). Storage rounds kg to 2dp, which moves a pound
 * weight by at most ~0.01 lb -- far less than the 0.25 lb it takes to reach
 * the next half -- so snapping to the nearest .5 recovers exactly what was
 * entered.
 */
export function snapToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

/**
 * Volume in the user's display unit: each set's weight snapped to its entry
 * increment, times reps, summed. For real entries the result is always a
 * whole number or a .5, never a storage rounding artifact like 3149.9 lb.
 */
export function volumeInUnit(
  sets: { weightKg: number; reps: number }[],
  unit: 'kg' | 'lb',
): number {
  return sets.reduce((sum, set) => sum + snapToHalf(fromKg(set.weightKg, unit)) * set.reps, 0);
}

/** A volume that is a whole number or .5: "3,150" or "3,150.5". */
export function formatVolume(value: number): string {
  const snapped = snapToHalf(value);
  return Number.isInteger(snapped)
    ? snapped.toLocaleString()
    : snapped.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function computeTotalVolumeKg(exercises: WorkoutExerciseWithSets[]): number {
  return exercises.reduce((sum, exercise) => {
    const logged = completedSetsOnly(exercise.sets);
    return sum + logged.reduce((setSum, set) => setSum + setVolumeKg(set), 0);
  }, 0);
}
