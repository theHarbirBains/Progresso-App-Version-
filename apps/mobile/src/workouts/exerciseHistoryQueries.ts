import { fetchAllRows, fetchAllRowsForIds } from '../lib/fetchAllRows';
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
 * currently in-progress workout (if any) since it isn't finished yet, and
 * excludes any individual set row that was added but never filled in/marked
 * complete (weight_kg/reps/completed_at all null -- a "planned but not yet
 * performed" row, see 20260907100001_set_completion_state.sql) even if the
 * workout it belongs to was otherwise completed.
 */
export async function fetchExerciseSetHistory(
  userId: string,
  exerciseId: string,
): Promise<HistoricalSet[]> {
  type Candidate = {
    id: string;
    workouts: {
      performed_at: string;
      completed_at: string | null;
      deleted_at: string | null;
    } | null;
  };
  // Paged and chunked (lib/fetchAllRows.ts), so years of one lift are read in full.
  const workoutExercises = await fetchAllRows<Candidate>((from, to) =>
    supabase
      .from('workout_exercises')
      .select('id, workouts(performed_at, completed_at, deleted_at)', { count: 'exact' })
      .eq('exercise_id', exerciseId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('id')
      .range(from, to),
  );
  const qualifying = workoutExercises.filter(
    (c) => c.workouts && c.workouts.deleted_at === null && c.workouts.completed_at !== null,
  );
  if (qualifying.length === 0) return [];

  const performedAtByWorkoutExercise = new Map(
    qualifying.map((c) => [c.id, c.workouts!.performed_at]),
  );
  const workoutExerciseIds = qualifying.map((c) => c.id);

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
    .map((s) => ({
      weightKg: Number(s.weight_kg),
      reps: s.reps,
      performedAt: performedAtByWorkoutExercise.get(s.workout_exercise_id)!,
      workoutExerciseId: s.workout_exercise_id,
    }))
    .sort((a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime());
}
