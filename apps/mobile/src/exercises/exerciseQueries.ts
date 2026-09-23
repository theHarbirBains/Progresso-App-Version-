import { escapeIlike } from '../lib/ilike';
import { supabase } from '../lib/supabase';
import type { LoggingStyle, MovementType } from './movementTypes';
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
  movementType: MovementType;
  loggingStyle: LoggingStyle | null;
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
  /** Defaults to true (A -> Z), matching the existing always-ascending behavior. */
  ascending?: boolean;
}

export interface FetchExercisesResult {
  rows: ExerciseRow[];
  hasMore: boolean;
  /** The exact count of rows matching the current filters (not just this page) -- from Supabase's `count: 'exact'`, not derived from `rows.length`. */
  totalCount: number;
}

interface ExerciseDbRow {
  id: string;
  name: string;
  muscle_group: MuscleGroup;
  movement_type: MovementType;
  logging_style: LoggingStyle | null;
  is_active: boolean;
  created_by: string | null;
}

export async function fetchExercises(params: FetchExercisesParams): Promise<FetchExercisesResult> {
  const { userId, search, muscleGroup, source, page, pageSize, ascending = true } = params;

  let query = supabase
    .from('exercises')
    .select('id, name, muscle_group, movement_type, logging_style, is_active, created_by', {
      count: 'exact',
    })
    .eq('is_active', true)
    .order('name', { ascending });

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    query = query.ilike('name', `%${escapeIlike(trimmedSearch)}%`);
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
  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as ExerciseDbRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    movementType: row.movement_type,
    loggingStyle: row.logging_style,
    isActive: row.is_active,
    createdBy: row.created_by,
  }));

  return { rows, hasMore: rows.length === pageSize, totalCount: count ?? rows.length };
}

export interface ExerciseSourceCounts {
  all: number;
  builtin: number;
  mine: number;
}

/**
 * The total number of active exercises in each source category, independent
 * of the current search/muscle-group filters -- what the library's "All /
 * Built-in / Mine" category cards show. Three minimal `count: 'exact',
 * head: true` requests (no rows fetched, just a count each), not a
 * duplicate of fetchExercises' own filtered/paginated query above.
 */
async function countExercises(refine?: 'builtin' | 'mine', userId?: string): Promise<number> {
  let query = supabase
    .from('exercises')
    .select('id', { count: 'exact', head: true })
    .eq('is_active', true);
  if (refine === 'builtin') {
    query = query.is('created_by', null);
  } else if (refine === 'mine' && userId) {
    query = query.eq('created_by', userId);
  }
  const { count, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

export async function fetchExerciseSourceCounts(userId: string): Promise<ExerciseSourceCounts> {
  const [all, builtin, mine] = await Promise.all([
    countExercises(),
    countExercises('builtin'),
    countExercises('mine', userId),
  ]);

  return { all, builtin, mine };
}
