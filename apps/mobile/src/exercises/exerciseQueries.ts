import { supabase } from '../lib/supabase';
import type { MuscleGroup } from './muscleGroups';

// Reads go directly to Supabase (anon key + RLS), never through the
// backend -- the existing exercises_select RLS policy already restricts
// rows to built-ins plus the caller's own custom exercises, so there's no
// business logic here for a backend endpoint to add.
export type ExerciseSource = 'all' | 'builtin' | 'mine';

export interface ExerciseRow {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  isActive: boolean;
  createdBy: string | null;
}

export interface FetchExercisesParams {
  userId: string;
  search: string;
  muscleGroup: MuscleGroup | null;
  source: ExerciseSource;
  page: number;
  pageSize: number;
}

export interface FetchExercisesResult {
  rows: ExerciseRow[];
  hasMore: boolean;
}

interface ExerciseDbRow {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  is_active: boolean;
  created_by: string | null;
}

export async function fetchExercises(params: FetchExercisesParams): Promise<FetchExercisesResult> {
  const { userId, search, muscleGroup, source, page, pageSize } = params;

  let query = supabase
    .from('exercises')
    .select('id, name, muscle_group, is_active, created_by')
    .eq('is_active', true)
    .order('name', { ascending: true });

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    query = query.ilike('name', `%${trimmedSearch}%`);
  }
  if (muscleGroup) {
    query = query.eq('muscle_group', muscleGroup);
  }
  if (source === 'builtin') {
    query = query.is('created_by', null);
  } else if (source === 'mine') {
    query = query.eq('created_by', userId);
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as ExerciseDbRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    isActive: row.is_active,
    createdBy: row.created_by,
  }));

  return { rows, hasMore: rows.length === pageSize };
}
