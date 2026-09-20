import type { MuscleGroup } from '../exercises/muscleGroups';
import type { MovementType } from '../exercises/movementTypes';
import type { HistoricalSet } from './exerciseHistoryQueries';

// Pure grouping logic, deliberately kept dependency-free (no Supabase import)
// so it can be used/tested independently of allExerciseHistoryQueries.ts's
// data-fetching function.
export interface HistoricalSetWithExercise extends HistoricalSet {
  exerciseId: string;
  exerciseName: string;
  /** The exercise's own muscle group (exercises.muscle_group) -- constant across every set of the same exercise, used to attribute real training exposure per muscle group (see muscleGroupProgress.ts). */
  muscleGroup: MuscleGroup;
  /** The exercise's own movement type (exercises.movement_type) -- constant across every set of the same exercise, same real classification Exercise Library shows (Bilateral/Unilateral; Progresso has no Compound/Isolation concept). */
  movementType: MovementType;
}

export interface ExerciseHistoryGroup {
  exerciseId: string;
  exerciseName: string;
  sets: HistoricalSet[];
}

/** Splits a combined history feed back out per exercise -- the input to every per-exercise derivation in exerciseProgress.ts. */
export function groupByExercise(sets: HistoricalSetWithExercise[]): ExerciseHistoryGroup[] {
  const groups = new Map<string, ExerciseHistoryGroup>();
  for (const s of sets) {
    let group = groups.get(s.exerciseId);
    if (!group) {
      group = { exerciseId: s.exerciseId, exerciseName: s.exerciseName, sets: [] };
      groups.set(s.exerciseId, group);
    }
    group.sets.push({
      weightKg: s.weightKg,
      reps: s.reps,
      performedAt: s.performedAt,
      workoutExerciseId: s.workoutExerciseId,
    });
  }
  return Array.from(groups.values());
}
