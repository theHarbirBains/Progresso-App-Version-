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
  /** An optional photo of the machine/equipment, shown as a small thumbnail in the library -- null for most exercises (built-ins never have one, a custom exercise only if its owner added one). */
  photoUrl: string | null;
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
  photo_url: string | null;
  is_active: boolean;
  created_by: string | null;
}

function toExerciseRow(row: ExerciseDbRow): ExerciseRow {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    movementType: row.movement_type,
    loggingStyle: row.logging_style,
    photoUrl: row.photo_url,
    isActive: row.is_active,
    createdBy: row.created_by,
  };
}

/** Builds the shared filtered/sorted exercises query -- everything fetchExercises (paginated) and fetchAllExercises (unpaginated, for the A-Z index list) have in common. */
function buildExerciseQuery(params: {
  userId: string;
  search: string;
  muscleGroup: MuscleGroup | null;
  source: ExerciseSource;
  ascending: boolean;
  count?: 'exact';
}) {
  const { userId, search, muscleGroup, source, ascending, count } = params;
  let query = supabase
    .from('exercises')
    .select(
      'id, name, muscle_group, movement_type, logging_style, photo_url, is_active, created_by',
      count ? { count } : undefined,
    )
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

  return query;
}

export async function fetchExercises(params: FetchExercisesParams): Promise<FetchExercisesResult> {
  const { userId, search, muscleGroup, source, page, pageSize, ascending = true } = params;

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await buildExerciseQuery({
    userId,
    search,
    muscleGroup,
    source,
    ascending,
    count: 'exact',
  }).range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const rows = ((data ?? []) as ExerciseDbRow[]).map(toExerciseRow);

  return { rows, hasMore: rows.length === pageSize, totalCount: count ?? rows.length };
}

export interface FetchAllExercisesParams {
  userId: string;
  search: string;
  muscleGroup: MuscleGroup | null;
  source: ExerciseSource;
  ascending?: boolean;
}

/**
 * Every exercise matching the current filters, unpaginated -- for the A-Z
 * indexed library list (same "load the whole filtered set up front" trade-
 * off foodLibraryGrouping.ts's own fetchAllFoods already makes: a real jump-
 * to-letter index needs the whole result set in memory, not one page at a
 * time).
 */
export async function fetchAllExercises(params: FetchAllExercisesParams): Promise<ExerciseRow[]> {
  const { userId, search, muscleGroup, source, ascending = true } = params;

  const { data, error } = await buildExerciseQuery({
    userId,
    search,
    muscleGroup,
    source,
    ascending,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ExerciseDbRow[]).map(toExerciseRow);
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
