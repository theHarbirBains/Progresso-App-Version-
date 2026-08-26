import { supabase } from '../lib/supabase';

// Raw historical data for one (user, exercise) pair -- the authoritative
// source for every Phase 5 analytics chart. Deliberately not rep_prs/
// one_rep_maxes: those tables hold only the *current* best per rep count
// (upserted in place, see supabase/migrations/20260823100008_pr_infrastructure.sql),
// so a historical trend line can only ever be reconstructed from the raw
// sets themselves. Same two-step fetch pattern as fetchPreviousPerformance
// in workoutQueries.ts, for the same reason: PostgREST embedded-table
// filter/order support isn't relied on here.
export interface HistoricalSet {
  weightKg: number;
  reps: number;
  performedAt: string;
  /** Identifies one occurrence of this exercise within one workout -- the grouping key for "top set per session". */
  workoutExerciseId: string;
}

/**
 * Every set ever logged for this exercise across the user's completed,
 * non-deleted workout history, chronological ascending. Excludes the
 * currently in-progress workout (if any) since it isn't finished yet.
 */
export async function fetchExerciseSetHistory(
  userId: string,
  exerciseId: string,
): Promise<HistoricalSet[]> {
  const { data: workoutExercises, error: weError } = await supabase
    .from('workout_exercises')
    .select('id, workouts(performed_at, completed_at, deleted_at)')
    .eq('exercise_id', exerciseId)
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (weError) throw new Error(weError.message);

  type Candidate = {
    id: string;
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

  const performedAtByWorkoutExercise = new Map(
    qualifying.map((c) => [c.id, c.workouts!.performed_at]),
  );
  const workoutExerciseIds = qualifying.map((c) => c.id);

  const { data: sets, error: setsError } = await supabase
    .from('sets')
    .select('workout_exercise_id, weight_kg, reps')
    .in('workout_exercise_id', workoutExerciseIds)
    .is('deleted_at', null);
  if (setsError) throw new Error(setsError.message);

  return (sets ?? [])
    .map((s) => ({
      weightKg: Number(s.weight_kg),
      reps: s.reps,
      performedAt: performedAtByWorkoutExercise.get(s.workout_exercise_id)!,
      workoutExerciseId: s.workout_exercise_id,
    }))
    .sort((a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime());
}
