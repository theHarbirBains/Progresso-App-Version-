import { supabase } from '../lib/supabase';
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
 * query pattern.
 */
export async function fetchAllExerciseHistory(
  userId: string,
): Promise<HistoricalSetWithExercise[]> {
  const { data: workoutExercises, error: weError } = await supabase
    .from('workout_exercises')
    .select(
      'id, exercise_id, exercises(name, muscle_group), workouts(performed_at, completed_at, deleted_at)',
    )
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (weError) throw new Error(weError.message);

  type Candidate = {
    id: string;
    exercise_id: string;
    exercises: { name: string; muscle_group: MuscleGroup } | null;
    workouts: {
      performed_at: string;
      completed_at: string | null;
      deleted_at: string | null;
    } | null;
  };
  const qualifying = ((workoutExercises ?? []) as unknown as Candidate[]).filter(
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
      },
    ]),
  );
  const workoutExerciseIds = qualifying.map((c) => c.id);

  // Excludes any set row that was added but never filled in/marked complete
  // (weight_kg/reps/completed_at all null -- a "planned but not yet
  // performed" row, see 20260907100001_set_completion_state.sql) even if the
  // workout it belongs to was otherwise completed.
  const { data: sets, error: setsError } = await supabase
    .from('sets')
    .select('workout_exercise_id, weight_kg, reps')
    .in('workout_exercise_id', workoutExerciseIds)
    .is('deleted_at', null)
    .not('completed_at', 'is', null);
  if (setsError) throw new Error(setsError.message);

  return (sets ?? [])
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
      };
    })
    .sort((a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime());
}
