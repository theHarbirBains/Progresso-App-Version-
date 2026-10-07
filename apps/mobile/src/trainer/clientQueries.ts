import { supabase } from '../lib/supabase';
import {
  enrichWorkoutSummaries,
  type EnrichedWorkoutSummary,
} from '../workouts/workoutHistoryEnrichment';
import { fetchWorkoutHistory } from '../workouts/workoutQueries';

// Read-only views of a client's data for their trainer. These go direct to
// Supabase: the trainer RLS policies (see the trainer_mode migration) decide
// which rows come back, so a trainer with no active link or no Trainer
// subscription gets nothing here. Writes never come through this file.

export interface ClientRecordRow {
  id: string;
  exerciseName: string;
  reps: number;
  bestWeightKg: number;
}

export const CLIENT_WORKOUT_PAGE_SIZE = 20;
const RECORD_LIMIT = 200;

/**
 * One page of the client's finished workouts, newest first, in the same shape the Feed
 * shows its own: duration, exercise and set counts, and each top set. It reads the
 * same history query and enrichment as Feed, so the trainer sees what the client sees.
 * `page` is 0-based; `hasMore` drives Load More.
 */
export async function fetchClientWorkoutFeed(
  clientId: string,
  page: number,
): Promise<{ workouts: EnrichedWorkoutSummary[]; hasMore: boolean }> {
  const { rows, hasMore } = await fetchWorkoutHistory(clientId, page, CLIENT_WORKOUT_PAGE_SIZE);
  const enriched = await enrichWorkoutSummaries(rows);
  return { workouts: enriched.filter((workout) => workout.completedAt !== null), hasMore };
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
): Promise<{ id: string; name: string; startedAt: string } | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, name, performed_at')
    .eq('user_id', clientId)
    .eq('logged_by', trainerId)
    .is('completed_at', null)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { id: string; name: string; performed_at: string } | null;
  return row ? { id: row.id, name: row.name, startedAt: row.performed_at } : null;
}

export interface TrainerOpenSession {
  workoutId: string;
  clientId: string;
  clientName: string;
  startedAt: string;
}

/** Every live session this trainer is running, newest first, with each client's name. */
export async function fetchMyOpenLiveSessions(trainerId: string): Promise<TrainerOpenSession[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select('id, user_id, performed_at')
    .eq('logged_by', trainerId)
    .is('completed_at', null)
    .is('deleted_at', null)
    .order('performed_at', { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; user_id: string; performed_at: string }[];
  if (rows.length === 0) return [];

  const clientIds = Array.from(new Set(rows.map((row) => row.user_id)));
  const { data: people, error: peopleError } = await supabase
    .from('users')
    .select('id, display_name')
    .in('id', clientIds);
  if (peopleError) throw new Error(peopleError.message);
  const names = new Map(
    ((people ?? []) as { id: string; display_name: string | null }[]).map((person) => [
      person.id,
      person.display_name,
    ]),
  );

  return rows.map((row) => ({
    workoutId: row.id,
    clientId: row.user_id,
    clientName: names.get(row.user_id) ?? 'Client',
    startedAt: row.performed_at,
  }));
}
