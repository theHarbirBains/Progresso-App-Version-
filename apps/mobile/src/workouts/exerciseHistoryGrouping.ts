import type { MachineDetails } from '../exercises/machineDetails';
import type { MuscleGroup } from '../exercises/muscleGroups';
import type { MovementType } from '../exercises/movementTypes';
import type { HistoricalSet } from './exerciseHistoryQueries';

// Pure grouping logic, deliberately kept dependency-free (no Supabase import)
// so it can be used/tested independently of allExerciseHistoryQueries.ts's
// data-fetching function.
export interface HistoricalSetWithExercise extends HistoricalSet, MachineDetails {
  exerciseId: string;
  exerciseName: string;
  /** The exercise's own muscle group (exercises.muscle_group) -- constant across every set of the same exercise, used to attribute real training exposure per muscle group (see muscleGroupProgress.ts). */
  muscleGroup: MuscleGroup;
  /** The exercise's own movement type (exercises.movement_type) -- constant across every set of the same exercise, same real classification Exercise Library shows (Bilateral/Unilateral; Progresso has no Compound/Isolation concept). */
  movementType: MovementType;
}

/**
 * The sets that count as sets of their own -- and can be a top set, a record or a best: no drop
 * sets (each is part of the set before it; volume still counts it).
 */
export function workingSets<T extends { isDrop?: boolean }>(sets: T[]): T[] {
  return sets.filter((set) => !set.isDrop);
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
      setId: s.setId,
      weightKg: s.weightKg,
      reps: s.reps,
      performedAt: s.performedAt,
      workoutExerciseId: s.workoutExerciseId,
      ...(s.isDrop ? { isDrop: true } : {}),
    });
  }
  return Array.from(groups.values());
}
