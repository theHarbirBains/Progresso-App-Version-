import { supabase } from '../lib/supabase';

// Read-only access to the PR/1RM tables Phase 0 already built and maintains
// via database triggers (see supabase/migrations/20260823100008_pr_infrastructure.sql).
// There is no write path here by design: rep_prs/one_rep_maxes have no
// insert/update/delete RLS policy for any client, so this file only ever
// reads what the database has already computed. A new PR is detected by
// re-reading this state right after a set is saved and comparing
// source_set_id -- never by calculating one client-side.

export interface RepPR {
  reps: number;
  bestWeightKg: number;
  sourceSetId: string;
  achievedAt: string;
}

export interface OneRepMax {
  weightKg: number;
  sourceSetId: string;
  achievedAt: string;
}

/** Every rep-count PR for this (user, exercise), ascending by reps. */
export async function fetchRepPRs(userId: string, exerciseId: string): Promise<RepPR[]> {
  const { data, error } = await supabase
    .from('rep_prs')
    .select('reps, best_weight_kg, source_set_id, achieved_at')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .order('reps', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    reps: row.reps,
    bestWeightKg: Number(row.best_weight_kg),
    sourceSetId: row.source_set_id,
    achievedAt: row.achieved_at,
  }));
}

/** The true 1RM for this (user, exercise), or null if no 1-rep set has ever been logged. */
export async function fetchOneRepMax(
  userId: string,
  exerciseId: string,
): Promise<OneRepMax | null> {
  const { data, error } = await supabase
    .from('one_rep_maxes')
    .select('weight_kg, source_set_id, achieved_at')
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    weightKg: Number(data.weight_kg),
    sourceSetId: data.source_set_id,
    achievedAt: data.achieved_at,
  };
}
