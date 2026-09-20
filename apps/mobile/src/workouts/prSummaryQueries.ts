import type { MuscleGroup } from '../exercises/muscleGroups';
import { supabase } from '../lib/supabase';
import type { OneRepMax, RepPR } from './prQueries';

// Cross-exercise variants of prQueries.ts's fetchRepPRs/fetchOneRepMax --
// same read-only tables (rep_prs/one_rep_maxes have no write RLS policy for
// any client; see prQueries.ts), just without the per-exercise filter, for
// the Progress feature's "PRs" and "1 Rep Max" pages which need to show
// records across every exercise at once rather than one at a time.

export interface RepPRWithExercise extends RepPR {
  exerciseId: string;
  exerciseName: string;
  /** The PR's exercise's muscle group -- lets a caller (e.g. Dashboard's
   * "Relevant PRs" widget) filter to PRs relevant to a specific muscle
   * group without a second query. */
  muscleGroup: MuscleGroup;
}

export interface OneRepMaxWithExercise extends OneRepMax {
  exerciseId: string;
  exerciseName: string;
}

interface RepPRRow {
  reps: number;
  best_weight_kg: string;
  source_set_id: string;
  achieved_at: string;
  exercise_id: string;
  exercises: { name: string; muscle_group: MuscleGroup } | null;
}

/** Every rep-count PR across every exercise for this user, most recently achieved first. */
export async function fetchAllRepPRs(userId: string): Promise<RepPRWithExercise[]> {
  const { data, error } = await supabase
    .from('rep_prs')
    .select(
      'reps, best_weight_kg, source_set_id, achieved_at, exercise_id, exercises(name, muscle_group)',
    )
    .eq('user_id', userId)
    .order('achieved_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as RepPRRow[]).map((row) => ({
    reps: row.reps,
    bestWeightKg: Number(row.best_weight_kg),
    sourceSetId: row.source_set_id,
    achievedAt: row.achieved_at,
    exerciseId: row.exercise_id,
    exerciseName: row.exercises?.name ?? 'Exercise',
    muscleGroup: row.exercises?.muscle_group ?? 'other',
  }));
}

interface OneRepMaxRow {
  weight_kg: string;
  source_set_id: string;
  achieved_at: string;
  exercise_id: string;
  exercises: { name: string } | null;
}

/** Every true 1RM across every exercise for this user, most recently achieved first. */
export async function fetchAllOneRepMaxes(userId: string): Promise<OneRepMaxWithExercise[]> {
  const { data, error } = await supabase
    .from('one_rep_maxes')
    .select('weight_kg, source_set_id, achieved_at, exercise_id, exercises(name)')
    .eq('user_id', userId)
    .order('achieved_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as OneRepMaxRow[]).map((row) => ({
    weightKg: Number(row.weight_kg),
    sourceSetId: row.source_set_id,
    achievedAt: row.achieved_at,
    exerciseId: row.exercise_id,
    exerciseName: row.exercises?.name ?? 'Exercise',
  }));
}
