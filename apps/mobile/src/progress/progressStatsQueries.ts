import { supabase } from '../lib/supabase';
import { toWorkoutSummary, type WorkoutSummary } from '../workouts/workoutQueries';

/**
 * Every completed, non-deleted workout this user has ever performed, oldest
 * first -- the unpaginated "give me everything" variant of
 * fetchWorkoutHistory (workoutQueries.ts's page-at-a-time version, built for
 * the Workouts tab's list), for Progress's lifetime stats and training
 * momentum, which both need the whole history at once rather than a page.
 * Same shape/mapping (toWorkoutSummary) as every other workout query, so
 * enrichWorkoutSummaries/computeMonthSummary can be reused as-is on the
 * result.
 */
export async function fetchAllCompletedWorkouts(userId: string): Promise<WorkoutSummary[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, name, performed_at, completed_at, workout_split_day_id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .is('deleted_at', null)
    .order('performed_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map(toWorkoutSummary);
}

/**
 * Resolves a PR's source_set_id (rep_prs/one_rep_maxes, see prSummaryQueries.ts)
 * back to the workout it was achieved in, so a PR on Progress can reuse the
 * existing ShareWorkout flow (workoutId) rather than a new sharing surface.
 * Null if the set can no longer be found (e.g. soft-deleted since the PR was recorded).
 */
export async function fetchWorkoutIdForSet(setId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('sets')
    .select('workout_exercise_id, workout_exercises(workout_id)')
    .eq('id', setId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const embedded = data.workout_exercises as unknown as { workout_id: string } | null;
  return embedded?.workout_id ?? null;
}
