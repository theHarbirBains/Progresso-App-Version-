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
 * The per-user cache fetchAllExercises/fetchExerciseSourceCounts both read from: every
 * active exercise (built-ins plus this user's own customs), unfiltered, sorted by name
 * ascending. Built-ins never change at runtime, and a user's own customs only change
 * through ExerciseFormScreen's create/update calls -- which explicitly invalidate this
 * via invalidateExerciseCache -- so there is no time-based expiry. This is what lets the
 * Exercise Library and the live-workout exercise picker (ExerciseBrowser, shared by
 * both) open repeatedly in one session -- picker opened for every "Add Exercise" tap --
 * without re-querying Supabase for data that has not changed.
 */
const fullExerciseListCache = new Map<string, ExerciseRow[]>();

async function fetchFullExerciseList(userId: string): Promise<ExerciseRow[]> {
  const cached = fullExerciseListCache.get(userId);
  if (cached) return cached;

  const { data, error } = await supabase
    .from('exercises')
    .select(
      'id, name, muscle_group, movement_type, logging_style, photo_url, is_active, created_by',
    )
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as ExerciseDbRow[]).map(toExerciseRow);
  fullExerciseListCache.set(userId, rows);
  return rows;
}

/**
 * Clears the cache fetchAllExercises/fetchExerciseSourceCounts read from, for this user.
 * Called after a custom exercise is created or updated (including deleted, which is a
 * deactivating update -- see ExerciseFormScreen), the only two ways this data changes.
 */
export function invalidateExerciseCache(userId: string): void {
  fullExerciseListCache.delete(userId);
}

/** search/muscleGroup/source filtering, done in memory over an already-fetched list --
 * the same semantics buildExerciseQuery applies in SQL (a plain case-insensitive
 * substring match on name, since the cached list is never re-escaped-ilike'd). The list
 * is already sorted ascending by name, and `.filter` preserves that order, so only a
 * descending request needs any re-ordering. */
function filterExerciseRows(
  rows: ExerciseRow[],
  params: {
    userId: string;
    search: string;
    muscleGroup: MuscleGroup | null;
    source: ExerciseSource;
  },
): ExerciseRow[] {
  const { userId, search, muscleGroup, source } = params;
  const trimmedSearch = search.trim().toLowerCase();
  return rows.filter((row) => {
    if (trimmedSearch && !row.name.toLowerCase().includes(trimmedSearch)) return false;
    if (muscleGroup && row.muscleGroup !== muscleGroup) return false;
    if (source === 'builtin' && row.createdBy !== null) return false;
    if (source === 'mine' && row.createdBy !== userId) return false;
    return true;
  });
}

/**
 * Every exercise matching the current filters, unpaginated -- for the A-Z
 * indexed library list (same "load the whole filtered set up front" trade-
 * off foodLibraryGrouping.ts's own fetchAllFoods already makes: a real jump-
 * to-letter index needs the whole result set in memory, not one page at a
 * time). Filters the cached full list in memory (see fetchFullExerciseList)
 * rather than a fresh Supabase query every time.
 */
export async function fetchAllExercises(params: FetchAllExercisesParams): Promise<ExerciseRow[]> {
  const { userId, search, muscleGroup, source, ascending = true } = params;

  const base = await fetchFullExerciseList(userId);
  const filtered = filterExerciseRows(base, { userId, search, muscleGroup, source });
  return ascending ? filtered : [...filtered].reverse();
}

export interface ExerciseSourceCounts {
  all: number;
  builtin: number;
  mine: number;
}

/**
 * The total number of active exercises in each source category, independent
 * of the current search/muscle-group filters -- what the library's "All /
 * Built-in / Mine" category cards show. Derived from the same cached full
 * list fetchAllExercises reads (see fetchFullExerciseList): no separate
 * count queries at all once that list is cached, and the one query it costs
 * on a cold cache is shared with whichever of fetchAllExercises/this one
 * asks first in the same session.
 */
export async function fetchExerciseSourceCounts(userId: string): Promise<ExerciseSourceCounts> {
  const base = await fetchFullExerciseList(userId);
  let builtin = 0;
  let mine = 0;
  for (const row of base) {
    if (row.createdBy === null) builtin += 1;
    else if (row.createdBy === userId) mine += 1;
  }
  return { all: base.length, builtin, mine };
}
