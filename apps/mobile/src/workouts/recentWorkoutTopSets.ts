import { completedSetsOnly } from './setCompletion';
import { heaviestSet } from './topSetSummary';
import type { WorkoutExerciseWithSets } from './workoutQueries';
type ExerciseWithSets = Pick<WorkoutExerciseWithSets, 'exerciseId' | 'exerciseName' | 'sets'>;

export interface WorkoutTopSet {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  reps: number;
}

/**
 * One entry per exercise in a workout that has a valid top set -- its
 * heaviest completed set, via the same heaviestSet/completedSetsOnly
 * definitions every other top-set readout in the app uses. Exercises with no
 * completed set are omitted entirely, never a placeholder. Kept in the
 * workout's own exercise order.
 */
export function computeWorkoutTopSets(exercises: ExerciseWithSets[]): WorkoutTopSet[] {
  const topSets: WorkoutTopSet[] = [];
  for (const exercise of exercises) {
    const top = heaviestSet(completedSetsOnly(exercise.sets));
    if (top) {
      topSets.push({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        weightKg: top.weightKg,
        reps: top.reps,
      });
    }
  }
  return topSets;
}

/** Exercises in a workout with at least one completed set -- "exercises completed". */
export function countCompletedExercises(exercises: ExerciseWithSets[]): number {
  return exercises.filter((exercise) => completedSetsOnly(exercise.sets).length > 0).length;
}
