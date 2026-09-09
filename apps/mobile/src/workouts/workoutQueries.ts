import { supabase } from '../lib/supabase';
import type { MuscleGroup } from '../exercises/muscleGroups';

// Direct-to-Supabase reads and writes for workout logging, per the approved
// Phase 3 architecture: ownership is fully enforced by existing RLS policies
// and the existing BEFORE INSERT/UPDATE triggers that re-derive user_id from
// the real parent row, so there's no business logic left for a backend layer
// to usefully centralize here (unlike usernames/exercise names, which needed
// friendly duplicate-name translation).

export interface WorkoutSummary {
  id: string;
  name: string;
  performedAt: string;
  completedAt: string | null;
  workoutSplitDayId: string | null;
}

export interface SetRecord {
  id: string;
  setIndex: number;
  /** Null until the set is actually logged -- a set is created blank
   * (weight/reps unknown) the moment "Add Set" is tapped, and filled in
   * afterward. */
  weightKg: number | null;
  reps: number | null;
  /** Null means "planned but not yet performed" -- the same nullable-
   * timestamp convention workouts.completed_at already uses. */
  completedAt: string | null;
}

// Defined in setCompletion.ts (no supabase import) rather than here, so
// purely client-side consumers (progressiveOverload.ts) can use it without
// pulling in supabase/AsyncStorage under Jest. Re-exported for every other
// existing import site.
export { completedSetsOnly, type CompletedSetRecord } from './setCompletion';

export interface WorkoutExerciseWithSets {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  orderIndex: number;
  sets: SetRecord[];
}

export interface WorkoutDetail extends WorkoutSummary {
  exercises: WorkoutExerciseWithSets[];
}

const ACTIVE_WORKOUT_CONFLICT_CONSTRAINT = 'workouts_one_active_per_user';

// Exported so other modules deriving from the same row shape (e.g. the
// Workouts tab's month-range fetch/enrichment) share one mapping instead of
// a second copy.
export function toWorkoutSummary(row: {
  id: string;
  name: string;
  performed_at: string;
  completed_at: string | null;
  workout_split_day_id: string | null;
}): WorkoutSummary {
  return {
    id: row.id,
    name: row.name,
    performedAt: row.performed_at,
    completedAt: row.completed_at,
    workoutSplitDayId: row.workout_split_day_id,
  };
}

export async function fetchActiveWorkout(userId: string): Promise<WorkoutSummary | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, name, performed_at, completed_at, workout_split_day_id')
    .eq('user_id', userId)
    .is('completed_at', null)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toWorkoutSummary(data) : null;
}

export interface FetchWorkoutHistoryResult {
  rows: WorkoutSummary[];
  hasMore: boolean;
}

export async function fetchWorkoutHistory(
  userId: string,
  page: number,
  pageSize: number,
): Promise<FetchWorkoutHistoryResult> {
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, error } = await supabase
    .from('workouts')
    .select('id, name, performed_at, completed_at, workout_split_day_id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .is('deleted_at', null)
    .order('performed_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  const rows = (data ?? []).map(toWorkoutSummary);
  return { rows, hasMore: rows.length === pageSize };
}

/**
 * Every completed workout performed within the given local calendar month --
 * for the Workouts tab's calendar + monthly summary, which need the whole
 * month at once rather than a page at a time. `month` is 1-indexed (matching
 * calendar convention, not Date's own 0-indexed month).
 */
export async function fetchWorkoutsForMonth(
  userId: string,
  year: number,
  month: number,
): Promise<WorkoutSummary[]> {
  // Local-time month boundaries (not Date.UTC) so a workout logged late at
  // night still lands in the calendar cell the user actually sees it under.
  const startOfMonth = new Date(year, month - 1, 1).toISOString();
  const startOfNextMonth = new Date(year, month, 1).toISOString();

  const { data, error } = await supabase
    .from('workouts')
    .select('id, name, performed_at, completed_at, workout_split_day_id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .is('deleted_at', null)
    .gte('performed_at', startOfMonth)
    .lt('performed_at', startOfNextMonth)
    .order('performed_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(toWorkoutSummary);
}

export async function fetchWorkoutDetail(workoutId: string): Promise<WorkoutDetail> {
  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .select('id, name, performed_at, completed_at, workout_split_day_id')
    .eq('id', workoutId)
    .single();
  if (workoutError) throw new Error(workoutError.message);

  const { data: workoutExercises, error: weError } = await supabase
    .from('workout_exercises')
    .select('id, exercise_id, order_index, exercises(name, muscle_group)')
    .eq('workout_id', workoutId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true });
  if (weError) throw new Error(weError.message);

  const workoutExerciseIds = (workoutExercises ?? []).map((we) => we.id);
  let setsByWorkoutExercise = new Map<string, SetRecord[]>();
  if (workoutExerciseIds.length > 0) {
    const { data: sets, error: setsError } = await supabase
      .from('sets')
      .select('id, workout_exercise_id, set_index, weight_kg, reps, completed_at')
      .in('workout_exercise_id', workoutExerciseIds)
      .is('deleted_at', null)
      .order('set_index', { ascending: true });
    if (setsError) throw new Error(setsError.message);

    setsByWorkoutExercise = new Map();
    for (const s of sets ?? []) {
      const list = setsByWorkoutExercise.get(s.workout_exercise_id) ?? [];
      list.push({
        id: s.id,
        setIndex: s.set_index,
        weightKg: s.weight_kg === null ? null : Number(s.weight_kg),
        reps: s.reps,
        completedAt: s.completed_at,
      });
      setsByWorkoutExercise.set(s.workout_exercise_id, list);
    }
  }

  const exercises: WorkoutExerciseWithSets[] = (workoutExercises ?? []).map((we) => {
    // Supabase's generated types aren't wired up in this project, so the
    // embedded relation comes back loosely typed; narrow it defensively.
    const embedded = we.exercises as unknown as { name: string; muscle_group: MuscleGroup } | null;
    return {
      id: we.id,
      exerciseId: we.exercise_id,
      exerciseName: embedded?.name ?? '',
      muscleGroup: embedded?.muscle_group ?? 'other',
      orderIndex: we.order_index,
      sets: setsByWorkoutExercise.get(we.id) ?? [],
    };
  });

  return { ...toWorkoutSummary(workout), exercises };
}

export type CreateWorkoutResult =
  | { type: 'created'; workout: WorkoutSummary }
  | { type: 'conflict'; existingWorkout: WorkoutSummary };

/**
 * Attempts to start a new workout. If the user already has an active one
 * (the one-active-workout-per-user constraint), this resolves to a
 * `'conflict'` result carrying that existing workout rather than throwing --
 * the caller is expected to offer to resume it instead of surfacing a raw
 * database error.
 */
export async function createWorkout(
  userId: string,
  name: string,
  workoutSplitDayId?: string,
): Promise<CreateWorkoutResult> {
  const insertPayload: Record<string, unknown> = { user_id: userId, name };
  if (workoutSplitDayId !== undefined) {
    insertPayload.workout_split_day_id = workoutSplitDayId;
  }

  const { data, error } = await supabase
    .from('workouts')
    .insert(insertPayload)
    .select('id, name, performed_at, completed_at, workout_split_day_id')
    .single();

  if (!error) {
    return { type: 'created', workout: toWorkoutSummary(data) };
  }

  if (error.code === '23505' && error.message.includes(ACTIVE_WORKOUT_CONFLICT_CONSTRAINT)) {
    const existing = await fetchActiveWorkout(userId);
    if (existing) {
      return { type: 'conflict', existingWorkout: existing };
    }
  }

  throw new Error(error.message);
}

export async function completeWorkout(workoutId: string): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', workoutId);
  if (error) throw new Error(error.message);
}

export async function addExerciseToWorkout(
  workoutId: string,
  exerciseId: string,
  orderIndex: number,
): Promise<string> {
  const { data, error } = await supabase
    .from('workout_exercises')
    .insert({ workout_id: workoutId, exercise_id: exerciseId, order_index: orderIndex })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function removeExerciseFromWorkout(workoutExerciseId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_exercises')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', workoutExerciseId);
  if (error) throw new Error(error.message);
}

export interface ReorderItem {
  id: string;
  workoutId: string;
  exerciseId: string;
  orderIndex: number;
}

/**
 * Reorders exercises within a workout via a single bulk upsert -- one
 * PostgREST request, one transaction -- so the deferred
 * (workout_id, order_index) uniqueness constraint is only checked at commit,
 * after every row's new position has been applied. Verified against a real
 * database in supabase/tests/run.mjs before this was written.
 */
export async function reorderExercises(items: ReorderItem[]): Promise<void> {
  const { error } = await supabase.from('workout_exercises').upsert(
    items.map((item) => ({
      id: item.id,
      workout_id: item.workoutId,
      exercise_id: item.exerciseId,
      order_index: item.orderIndex,
    })),
  );
  if (error) throw new Error(error.message);
}

/**
 * Creates a blank, incomplete set -- weight/reps/completed_at all start
 * null. This is the only way sets are created now: "Add Set" always adds
 * exactly one blank row immediately, which the user then fills in and
 * marks complete via updateSet.
 */
export async function createSet(workoutExerciseId: string, setIndex: number): Promise<SetRecord> {
  const { data, error } = await supabase
    .from('sets')
    .insert({ workout_exercise_id: workoutExerciseId, set_index: setIndex })
    .select('id, set_index, weight_kg, reps, completed_at')
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    setIndex: data.set_index,
    weightKg: data.weight_kg === null ? null : Number(data.weight_kg),
    reps: data.reps,
    completedAt: data.completed_at,
  };
}

export async function updateSet(
  setId: string,
  updates: { weightKg?: number; reps?: number; completedAt?: string | null },
): Promise<SetRecord> {
  const payload: Record<string, unknown> = {};
  if (updates.weightKg !== undefined) payload.weight_kg = updates.weightKg;
  if (updates.reps !== undefined) payload.reps = updates.reps;
  if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;

  const { data, error } = await supabase
    .from('sets')
    .update(payload)
    .eq('id', setId)
    .select('id, set_index, weight_kg, reps, completed_at')
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    setIndex: data.set_index,
    weightKg: data.weight_kg === null ? null : Number(data.weight_kg),
    reps: data.reps,
    completedAt: data.completed_at,
  };
}

export async function deleteSet(setId: string): Promise<void> {
  const { error } = await supabase
    .from('sets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', setId);
  if (error) throw new Error(error.message);
}

/**
 * The most recent past occurrence of this exercise (excluding the workout
 * currently being logged), with its sets -- the Phase 3 foundation for
 * "previous performance". Deliberately raw sets only, never rep_prs/
 * one_rep_maxes: those tables already exist and are already correctly
 * maintained, but surfacing them is explicitly deferred to the Phase 4 PR
 * engine work.
 */
export async function fetchPreviousPerformance(
  userId: string,
  exerciseId: string,
  excludeWorkoutId: string,
): Promise<{ performedAt: string; sets: SetRecord[] } | null> {
  const { data: candidates, error: candidatesError } = await supabase
    .from('workout_exercises')
    .select('id, workout_id, workouts(performed_at, deleted_at)')
    .eq('exercise_id', exerciseId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .neq('workout_id', excludeWorkoutId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (candidatesError) throw new Error(candidatesError.message);

  type Candidate = {
    id: string;
    workout_id: string;
    workouts: { performed_at: string; deleted_at: string | null } | null;
  };
  const qualifying = ((candidates ?? []) as unknown as Candidate[]).filter(
    (c) => c.workouts && c.workouts.deleted_at === null,
  );
  if (qualifying.length === 0) return null;

  qualifying.sort(
    (a, b) =>
      new Date(b.workouts!.performed_at).getTime() - new Date(a.workouts!.performed_at).getTime(),
  );
  const mostRecent = qualifying[0];

  const { data: sets, error: setsError } = await supabase
    .from('sets')
    .select('id, set_index, weight_kg, reps, completed_at')
    .eq('workout_exercise_id', mostRecent.id)
    .is('deleted_at', null)
    // "Previous performance" only ever means real, logged history -- never
    // a set that was left blank/incomplete in that past workout.
    .not('completed_at', 'is', null)
    .order('set_index', { ascending: true });
  if (setsError) throw new Error(setsError.message);

  return {
    performedAt: mostRecent.workouts!.performed_at,
    sets: (sets ?? []).map((s) => ({
      id: s.id,
      setIndex: s.set_index,
      weightKg: s.weight_kg === null ? null : Number(s.weight_kg),
      reps: s.reps,
      completedAt: s.completed_at,
    })),
  };
}
