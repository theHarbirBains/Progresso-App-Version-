import { supabase } from '../lib/supabase';

// Read-only views of a client's data for their trainer. These go direct to
// Supabase: the trainer RLS policies (see the trainer_mode migration) decide
// which rows come back, so a trainer with no active link or no Trainer
// subscription gets nothing here. Writes never come through this file.

export interface ClientWorkoutRow {
  id: string;
  name: string;
  performedAt: string;
  completedAt: string | null;
}

export interface ClientRecordRow {
  id: string;
  exerciseName: string;
  reps: number;
  bestWeightKg: number;
}

const WORKOUT_LIMIT = 30;
const RECORD_LIMIT = 200;

/** The client's most recent workouts, newest first. */
export async function fetchClientWorkouts(clientId: string): Promise<ClientWorkoutRow[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, name, performed_at, completed_at')
    .eq('user_id', clientId)
    .is('deleted_at', null)
    .order('performed_at', { ascending: false })
    .limit(WORKOUT_LIMIT);
  if (error) throw new Error(error.message);

  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    performedAt: row.performed_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
  }));
}

/** The client's rep-count PRs, grouped by exercise name, then by reps. */
export async function fetchClientPersonalRecords(clientId: string): Promise<ClientRecordRow[]> {
  const { data, error } = await supabase
    .from('rep_prs')
    .select('id, reps, best_weight_kg, exercises(name)')
    .eq('user_id', clientId)
    .limit(RECORD_LIMIT);
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const exercise = row.exercises as { name: string } | { name: string }[] | null;
    const name = Array.isArray(exercise) ? exercise[0]?.name : exercise?.name;
    return {
      id: row.id as string,
      exerciseName: name ?? 'Exercise',
      reps: row.reps as number,
      bestWeightKg: Number(row.best_weight_kg),
    };
  });

  return rows.sort((a, b) => a.exerciseName.localeCompare(b.exerciseName) || a.reps - b.reps);
}

/** The trainer's open live session for this client, if one is running. */
export async function fetchOpenLiveSession(
  clientId: string,
  trainerId: string,
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, name')
    .eq('user_id', clientId)
    .eq('logged_by', trainerId)
    .is('completed_at', null)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { id: string; name: string } | null;
  return row ? { id: row.id, name: row.name } : null;
}
