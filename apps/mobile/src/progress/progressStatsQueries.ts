import { fetchAllRows, fetchAllRowsForIds } from '../lib/fetchAllRows';
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
  // Paged (lib/fetchAllRows.ts); id breaks ties so no workout falls between two pages.
  const rows = await fetchAllRows<Parameters<typeof toWorkoutSummary>[0]>((from, to) =>
    supabase
      .from('workouts')
      .select('id, name, performed_at, completed_at, workout_split_day_id', { count: 'exact' })
      .eq('user_id', userId)
      .not('completed_at', 'is', null)
      .is('deleted_at', null)
      .order('performed_at', { ascending: true })
      .order('id')
      .range(from, to),
  );
  return rows.map(toWorkoutSummary);
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

/** What a workout with cardio's total time is worked out from (workoutTime.ts). */
export interface WorkoutCardioTimes {
  cardio: { durationSeconds: number }[];
  /** When each of its finished sets was finished, warm-ups and drops too. */
  setTimes: string[];
  /** Whether it has a working set finished -- with none, it's cardio alone. */
  hasStrength: boolean;
}

/**
 * Each of the person's workouts with cardio -- its activities' times and its sets' -- for totals
 * over many workouts (a lifetime's time). A workout without cardio isn't in it: its time is start
 * to finish.
 */
export async function fetchWorkoutCardioTimes(
  userId: string,
): Promise<Map<string, WorkoutCardioTimes>> {
  const cardioRows = await fetchAllRows<{
    id: string;
    workout_id: string;
    duration_seconds: number;
  }>((from, to) =>
    supabase
      .from('workout_cardio')
      .select('id, workout_id, duration_seconds', { count: 'exact' })
      .eq('user_id', userId)
      .order('id')
      .range(from, to),
  );
  const times = new Map<string, WorkoutCardioTimes>();
  for (const row of cardioRows) {
    const entry = times.get(row.workout_id) ?? { cardio: [], setTimes: [], hasStrength: false };
    entry.cardio.push({ durationSeconds: Number(row.duration_seconds) });
    times.set(row.workout_id, entry);
  }
  if (times.size === 0) return times;

  const exerciseRows = await fetchAllRowsForIds<{ id: string; workout_id: string }>(
    [...times.keys()],
    (ids, from, to) =>
      supabase
        .from('workout_exercises')
        .select('id, workout_id', { count: 'exact' })
        .in('workout_id', ids)
        .is('deleted_at', null)
        .order('id')
        .range(from, to),
  );
  const workoutOf = new Map(exerciseRows.map((row) => [row.id, row.workout_id]));
  if (workoutOf.size === 0) return times;
  const setRows = await fetchAllRowsForIds<{
    id: string;
    workout_exercise_id: string;
    completed_at: string;
    is_warmup: boolean | null;
  }>([...workoutOf.keys()], (ids, from, to) =>
    supabase
      .from('sets')
      .select('id, workout_exercise_id, completed_at, is_warmup', { count: 'exact' })
      .in('workout_exercise_id', ids)
      .is('deleted_at', null)
      .not('completed_at', 'is', null)
      .order('id')
      .range(from, to),
  );
  for (const row of setRows) {
    const entry = times.get(workoutOf.get(row.workout_exercise_id) ?? '');
    if (!entry) continue;
    entry.setTimes.push(row.completed_at);
    if (row.is_warmup !== true) entry.hasStrength = true;
  }
  return times;
}
