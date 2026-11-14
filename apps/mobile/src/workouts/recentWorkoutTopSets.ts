import { measurementTypeOf, type MeasurementType } from '../exercises/movementTypes';
import { bestLoggedSet, loggedSets, setValuesOf } from './setValues';
import type { WorkoutExerciseWithSets } from './workoutQueries';
type ExerciseWithSets = Pick<
  WorkoutExerciseWithSets,
  'exerciseId' | 'exerciseName' | 'photoUrl' | 'gym' | 'attachment' | 'sets' | 'measurementType'
>;

export interface WorkoutTopSet {
  exerciseId: string;
  exerciseName: string;
  /** The exercise's machine photo, or null when it has none -- shown beside the top set only when present. */
  photoUrl: string | null;
  /** Its gym and handle, when it has them -- under its name, as the Exercise Library shows them. */
  gym?: string | null;
  attachment?: string | null;
  /** What the exercise was logged as. Absent means weight and reps (data from before measurement types). */
  measurementType?: MeasurementType;
  /** Weight and reps: the heaviest set. Null for a bodyweight or timed exercise. */
  weightKg: number | null;
  /** Null for a timed exercise. */
  reps: number | null;
  /** A timed exercise's longest set, in seconds. */
  durationSeconds?: number | null;
}

/**
 * One entry per exercise in a workout with a logged set -- its best set for what it measures:
 * the heaviest (the Top Set) for weight and reps, the most reps at bodyweight, the longest
 * when timed (bestLoggedSet). Exercises with no completed set are omitted entirely, never a
 * placeholder. Kept in the workout's own exercise order.
 */
export function computeWorkoutTopSets(exercises: ExerciseWithSets[]): WorkoutTopSet[] {
  const topSets: WorkoutTopSet[] = [];
  for (const exercise of exercises) {
    const type = measurementTypeOf(exercise);
    const top = bestLoggedSet(exercise.sets, type);
    if (top) {
      topSets.push({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        photoUrl: exercise.photoUrl,
        gym: exercise.gym ?? null,
        attachment: exercise.attachment ?? null,
        ...setValuesOf(top, type),
      });
    }
  }
  return topSets;
}

/** Exercises in a workout with at least one completed set -- "exercises completed". */
export function countCompletedExercises(exercises: ExerciseWithSets[]): number {
  return exercises.filter(
    (exercise) => loggedSets(exercise.sets, measurementTypeOf(exercise)).length > 0,
  ).length;
}
