import { fetchAllRows, fetchAllRowsForIds } from '../lib/fetchAllRows';
import { supabase } from '../lib/supabase';
import type { MovementType } from '../exercises/movementTypes';
import type { MuscleGroup } from '../exercises/muscleGroups';
import type { HistoricalSetWithExercise } from './exerciseHistoryGrouping';

export type { HistoricalSetWithExercise, ExerciseHistoryGroup } from './exerciseHistoryGrouping';
export { groupByExercise } from './exerciseHistoryGrouping';

/**
 * Every set ever logged across ALL exercises for this user's completed,
 * non-deleted workout history -- the multi-exercise generalization of
 * fetchExerciseSetHistory (exerciseHistoryQueries.ts), for the Progress
 * feature's cross-exercise views (Exercises page, Overview's "Exercises
 * Improving", Muscle Group Progress). One request instead of one-per-exercise,
 * so a user with many different logged exercises doesn't trigger an N+1
 * query pattern. Both reads are paged and the set ids chunked (lib/fetchAllRows.ts),
 * so a long history is read in full rather than cut off at Supabase's row cap.
 */
export async function fetchAllExerciseHistory(
  userId: string,
): Promise<HistoricalSetWithExercise[]> {
  type Candidate = {
    id: string;
    exercise_id: string;
    exercises: { name: string; muscle_group: MuscleGroup; movement_type: MovementType } | null;
    workouts: {
      performed_at: string;
      completed_at: string | null;
      deleted_at: string | null;
    } | null;
  };
  const workoutExercises = await fetchAllRows<Candidate>((from, to) =>
    supabase
      .from('workout_exercises')
      .select(
        'id, exercise_id, exercises(name, muscle_group, movement_type), workouts(performed_at, completed_at, deleted_at)',
        { count: 'exact' },
      )
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('id')
      .range(from, to),
  );
  const qualifying = workoutExercises.filter(
    (c) => c.workouts && c.workouts.deleted_at === null && c.workouts.completed_at !== null,
  );
  if (qualifying.length === 0) return [];

  const infoByWorkoutExercise = new Map(
    qualifying.map((c) => [
      c.id,
      {
        performedAt: c.workouts!.performed_at,
        exerciseId: c.exercise_id,
        exerciseName: c.exercises?.name ?? 'Exercise',
        muscleGroup: c.exercises?.muscle_group ?? 'other',
        movementType: c.exercises?.movement_type ?? 'bilateral',
      },
    ]),
  );
  const workoutExerciseIds = qualifying.map((c) => c.id);

  // Excludes any set row that was added but never filled in/marked complete
  // (weight_kg/reps/completed_at all null -- a "planned but not yet
  // performed" row, see 20260907100001_set_completion_state.sql) even if the
  // workout it belongs to was otherwise completed.
  const sets = await fetchAllRowsForIds<{
    workout_exercise_id: string;
    weight_kg: string | number | null;
    reps: number;
  }>(workoutExerciseIds, (ids, from, to) =>
    supabase
      .from('sets')
      .select('workout_exercise_id, weight_kg, reps', { count: 'exact' })
      .in('workout_exercise_id', ids)
      .is('deleted_at', null)
      .not('completed_at', 'is', null)
      .order('id')
      .range(from, to),
  );

  return sets
    .map((s) => {
      const info = infoByWorkoutExercise.get(s.workout_exercise_id)!;
      return {
        weightKg: Number(s.weight_kg),
        reps: s.reps,
        performedAt: info.performedAt,
        workoutExerciseId: s.workout_exercise_id,
        exerciseId: info.exerciseId,
        exerciseName: info.exerciseName,
        muscleGroup: info.muscleGroup,
        movementType: info.movementType,
      };
    })
    .sort((a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime());
}
