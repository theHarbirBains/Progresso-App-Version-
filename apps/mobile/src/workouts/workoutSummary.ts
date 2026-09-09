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

export function computeTotalVolumeKg(exercises: WorkoutExerciseWithSets[]): number {
  return exercises.reduce((sum, exercise) => {
    const logged = completedSetsOnly(exercise.sets);
    return sum + logged.reduce((setSum, set) => setSum + set.weightKg * set.reps, 0);
  }, 0);
}
