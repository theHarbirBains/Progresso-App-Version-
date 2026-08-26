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
}

export interface SetRecord {
  id: string;
  setIndex: number;
  weightKg: number;
  reps: number;
}

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

function toWorkoutSummary(row: {
  id: string;
  name: string;
  performed_at: string;
  completed_at: string | null;
}): WorkoutSummary {
  return {
    id: row.id,
    name: row.name,
    performedAt: row.performed_at,
    completedAt: row.completed_at,
  };
}

export async function fetchActiveWorkout(userId: string): Promise<WorkoutSummary | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, name, performed_at, completed_at')
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
    .select('id, name, performed_at, completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .is('deleted_at', null)
    .order('performed_at', { ascending: false })
    .range(from, to);

  if (error) throw new Error(error.message);
  const rows = (data ?? []).map(toWorkoutSummary);
  return { rows, hasMore: rows.length === pageSize };
}

export async function fetchWorkoutDetail(workoutId: string): Promise<WorkoutDetail> {
  const { data: workout, error: workoutError } = await supabase
    .from('workouts')
    .select('id, name, performed_at, completed_at')
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
      .select('id, workout_exercise_id, set_index, weight_kg, reps')
      .in('workout_exercise_id', workoutExerciseIds)
      .is('deleted_at', null)
      .order('set_index', { ascending: true });
    if (setsError) throw new Error(setsError.message);

    setsByWorkoutExercise = new Map();
    for (const s of sets ?? []) {
      const list = setsByWorkoutExercise.get(s.workout_exercise_id) ?? [];
      list.push({ id: s.id, setIndex: s.set_index, weightKg: Number(s.weight_kg), reps: s.reps });
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
export async function createWorkout(userId: string, name: string): Promise<CreateWorkoutResult> {
  const { data, error } = await supabase
    .from('workouts')
    .insert({ user_id: userId, name })
    .select('id, name, performed_at, completed_at')
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

export async function createSet(
  workoutExerciseId: string,
  setIndex: number,
  weightKg: number,
  reps: number,
): Promise<SetRecord> {
  const { data, error } = await supabase
    .from('sets')
    .insert({
      workout_exercise_id: workoutExerciseId,
      set_index: setIndex,
      weight_kg: weightKg,
      reps,
    })
    .select('id, set_index, weight_kg, reps')
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    setIndex: data.set_index,
    weightKg: Number(data.weight_kg),
    reps: data.reps,
  };
}

export async function updateSet(
  setId: string,
  updates: { weightKg?: number; reps?: number },
): Promise<SetRecord> {
  const payload: Record<string, unknown> = {};
  if (updates.weightKg !== undefined) payload.weight_kg = updates.weightKg;
  if (updates.reps !== undefined) payload.reps = updates.reps;

  const { data, error } = await supabase
    .from('sets')
    .update(payload)
    .eq('id', setId)
    .select('id, set_index, weight_kg, reps')
    .single();
  if (error) throw new Error(error.message);
  return {
    id: data.id,
    setIndex: data.set_index,
    weightKg: Number(data.weight_kg),
    reps: data.reps,
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
    .select('id, set_index, weight_kg, reps')
    .eq('workout_exercise_id', mostRecent.id)
    .is('deleted_at', null)
    .order('set_index', { ascending: true });
  if (setsError) throw new Error(setsError.message);

  return {
    performedAt: mostRecent.workouts!.performed_at,
    sets: (sets ?? []).map((s) => ({
      id: s.id,
      setIndex: s.set_index,
      weightKg: Number(s.weight_kg),
      reps: s.reps,
    })),
  };
}
