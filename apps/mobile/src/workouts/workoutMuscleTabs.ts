import type { MuscleGroup } from '../exercises/muscleGroups';

/** A live workout's muscle tab: every exercise, or one primary muscle group's. */
export type MuscleTab = MuscleGroup | 'all';

/**
 * The primary muscle groups a workout trains so far, each once, in the order their first
 * exercise was added -- one tab each along the top of the live workout.
 */
export function workoutMuscleTabs(exercises: { muscleGroup: MuscleGroup }[]): MuscleGroup[] {
  return Array.from(new Set(exercises.map((exercise) => exercise.muscleGroup)));
}
