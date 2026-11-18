import type { ExerciseResponse, SharedExerciseResponse, ShareSource } from '../lib/exercisesApi';
import { escapeIlike } from '../lib/ilike';
import { supabase } from '../lib/supabase';
import { MACHINE_COLUMNS, machineDetailsOf, type MachineDetails } from './machineDetails';
import { EQUIPMENT_LABELS, type Equipment } from './equipment';
import { loadBuiltinExtras } from './builtinExtras';
// Plugs the built-in guides' Supabase reads into builtinExtras.ts.
import './exerciseGuide';
import type { LoadType, Pulley, PulleyPosition } from './machineLoad';
import type { LoggingStyle, MeasurementType, MovementType } from './movementTypes';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from './muscleGroups';

// Reads go directly to Supabase (anon key + RLS), never through the
// backend -- the existing exercises_select RLS policy already restricts
// rows to built-ins plus the caller's own custom exercises, so there's no
// business logic here for a backend endpoint to add.
// 'friends' is the people you follow's own exercises, to add to yours; a trainer's or a client's
// are in All, beside your own.
export type ExerciseSource = 'all' | 'builtin' | 'mine' | 'friends';

export interface ExerciseRow {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  movementType: MovementType;
  loggingStyle: LoggingStyle | null;
  /** What a set of this exercise records: weight and reps, reps only, or a time. */
  measurementType: MeasurementType;
  /** An optional photo of the machine/equipment, shown as a small thumbnail in the library -- null for most exercises (built-ins never have one, a custom exercise only if its owner added one). */
  photoUrl: string | null;
  /** What sets a custom exercise's machine apart (all optional): its gym, how it feels, its handle. */
  gym?: string | null;
  feelNotes?: string | null;
  attachment?: string | null;
  /** How it's loaded and an old heavier/lighter pulley (exercises/machineLoad.ts) -- optional too. */
  loadType?: LoadType | null;
  pulley?: Pulley | null;
  /** What it's done with, how it's held, where its cable starts and setup notes (all optional). */
  equipment?: Equipment | null;
  grip?: string | null;
  pulleyPosition?: PulleyPosition | null;
  setupDetails?: string | null;
  isActive: boolean;
  createdBy: string | null;
  /** A built-in's illustration (exerciseGuide.ts's extras), once read. */
  slug?: string | null;
  /** The muscle groups a built-in also works -- it's listed under them too, after the ones it's for. */
  secondaryMuscleGroups?: MuscleGroup[];
  /** Other names a built-in is found by ("Deadlift" for Barbell Deadlift). */
  searchAliases?: string[];
  /**
   * Someone else's exercise, shared with this person (lib/exercisesApi's fetchSharedExercises):
   * whose, how, and whether they already have their own by that name at that gym. Using it makes
   * it theirs first (copyExercise). Absent for a built-in or their own.
   */
  shared?: { source: ShareSource; ownerId: string; ownerName: string; inLibrary: boolean };
}

/** An exercise as the API returns it, as a row. */
export function exerciseRowFromResponse(exercise: ExerciseResponse): ExerciseRow {
  return {
    id: exercise.id,
    name: exercise.name,
    muscleGroup: exercise.muscleGroup,
    movementType: exercise.movementType,
    loggingStyle: exercise.loggingStyle,
    measurementType: exercise.measurementType ?? 'weight_reps',
    photoUrl: exercise.photoUrl,
    gym: exercise.gym ?? null,
    feelNotes: exercise.feelNotes ?? null,
    attachment: exercise.attachment ?? null,
    loadType: exercise.loadType ?? null,
    pulley: exercise.pulley ?? null,
    equipment: exercise.equipment ?? null,
    grip: exercise.grip ?? null,
    pulleyPosition: exercise.pulleyPosition ?? null,
    setupDetails: exercise.setupDetails ?? null,
    isActive: exercise.isActive,
    createdBy: exercise.createdBy,
  };
}

/** A shared exercise as a row, saying whose it is. */
export function sharedExerciseRow(exercise: SharedExerciseResponse): ExerciseRow {
  return {
    ...exerciseRowFromResponse(exercise),
    shared: {
      source: exercise.source,
      ownerId: exercise.owner.id,
      ownerName: exercise.owner.displayName ?? exercise.owner.username ?? 'Someone',
      inLibrary: exercise.inLibrary,
    },
  };
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
  measurement_type: MeasurementType | null;
  photo_url: string | null;
  gym: string | null;
  feel_notes: string | null;
  attachment: string | null;
  load_type: LoadType | null;
  pulley: Pulley | null;
  equipment?: Equipment | null;
  grip?: string | null;
  pulley_position?: PulleyPosition | null;
  setup_details?: string | null;
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
    measurementType: row.measurement_type ?? 'weight_reps',
    photoUrl: row.photo_url,
    gym: row.gym ?? null,
    feelNotes: row.feel_notes ?? null,
    attachment: row.attachment ?? null,
    loadType: row.load_type ?? null,
    pulley: row.pulley ?? null,
    equipment: row.equipment ?? null,
    grip: row.grip ?? null,
    pulleyPosition: row.pulley_position ?? null,
    setupDetails: row.setup_details ?? null,
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
      'id, name, muscle_group, movement_type, logging_style, measurement_type, photo_url, gym, feel_notes, attachment, load_type, pulley, equipment, grip, pulley_position, setup_details, is_active, created_by',
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
  /** The exercises shared with this person (sharedExerciseRow), for All and Friends. */
  shared?: ExerciseRow[];
  /** Only what's done with this equipment. */
  equipment?: Equipment | null;
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
      'id, name, muscle_group, movement_type, logging_style, measurement_type, photo_url, gym, feel_notes, attachment, load_type, pulley, equipment, grip, pulley_position, setup_details, is_active, created_by',
    )
    .eq('is_active', true)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);

  const rows = withBuiltinExtras(
    ((data ?? []) as ExerciseDbRow[]).map(toExerciseRow),
    await loadBuiltinExtras(),
  );
  fullExerciseListCache.set(userId, rows);
  return rows;
}

/** Built-ins with their slug, the muscles they also work and their other names (when they could be read). */
function withBuiltinExtras(
  rows: ExerciseRow[],
  extras: Awaited<ReturnType<typeof loadBuiltinExtras>>,
): ExerciseRow[] {
  if (extras.size === 0) return rows;
  return rows.map((row) => {
    const extra = row.createdBy === null ? extras.get(row.id) : undefined;
    return extra
      ? {
          ...row,
          slug: extra.slug,
          secondaryMuscleGroups: extra.secondaryMuscleGroups,
          searchAliases: extra.searchAliases,
        }
      : row;
  });
}

/** Lower case, letters and digits only, single-spaced: "Farmer's Bent-Over Carry" -> "farmers bent over carry". */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Shorthand people type for equipment. */
const SHORTHAND: Record<string, string> = {
  db: 'dumbbell',
  bb: 'barbell',
  kb: 'kettlebell',
  ez: 'ez',
  sm: 'smith',
};

/**
 * Whether an exercise matches what's typed: the text anywhere in its name (as always), or every
 * word typed starting a word of its name, one of its other names, its muscle group, its equipment
 * or what it's held by (its attachment and grip), in any order -- so "curl dumbbell" finds
 * Dumbbell Curl, "db row" finds Dumbbell Bent-Over Row, "v handle row" the V-handle
 * cable rows and "chest cable" every cable chest exercise.
 */
export function matchesExerciseSearch(
  row: Pick<ExerciseRow, 'name' | 'searchAliases'> &
    Partial<Pick<ExerciseRow, 'muscleGroup' | 'equipment' | 'attachment' | 'grip'>>,
  search: string,
): boolean {
  const query = normalize(search);
  if (!query) return true;
  const names = [row.name, ...(row.searchAliases ?? [])].map(normalize);
  if (names.some((name) => name.includes(query))) return true;
  const setup = [
    row.muscleGroup ? MUSCLE_GROUP_LABELS[row.muscleGroup] : null,
    row.equipment ? EQUIPMENT_LABELS[row.equipment] : null,
    row.attachment,
    row.grip,
  ]
    .filter((part): part is string => !!part)
    .map(normalize);
  const words = new Set([...names, ...setup].join(' ').split(' '));
  return query.split(' ').every((token) => {
    const wanted = SHORTHAND[token] ?? token;
    for (const word of words) if (word.startsWith(wanted) || word.startsWith(token)) return true;
    return false;
  });
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
    equipment?: Equipment | null;
  },
): ExerciseRow[] {
  const { userId, search, muscleGroup, source, equipment } = params;
  return rows.filter((row) => {
    if (!matchesExerciseSearch(row, search)) return false;
    // A muscle filter is the exercise's primary muscle group alone.
    if (muscleGroup && row.muscleGroup !== muscleGroup) return false;
    if (equipment && row.equipment !== equipment) return false;
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
  const { userId, search, muscleGroup, source, ascending = true, shared = [], equipment } = params;

  const pool = libraryPool(await fetchFullExerciseList(userId), shared, userId, source);
  const filtered = filterExerciseRows(pool, {
    userId,
    search,
    muscleGroup,
    source,
    equipment,
  });
  return ascending ? filtered : [...filtered].reverse();
}

/**
 * What a library tab is drawn from: Friends is the people you follow's exercises; every other
 * tab, the built-ins and your own -- and in All, your trainer's and your clients' too, less any
 * you already have your own of. The full list can hold others' exercises the database lets this
 * person read (a client's, for their trainer; one used in a group they were in); those only show
 * as shared, never as theirs.
 */
function libraryPool(
  base: ExerciseRow[],
  shared: ExerciseRow[],
  userId: string,
  source: ExerciseSource,
): ExerciseRow[] {
  if (source === 'friends') return shared.filter((row) => row.shared?.source === 'friend');
  const own = base.filter((row) => row.createdBy === null || row.createdBy === userId);
  if (source !== 'all') return own;
  const linked = shared.filter((row) => row.shared?.source !== 'friend' && !row.shared?.inLibrary);
  if (linked.length === 0) return own;
  return [...own, ...linked].sort((a, b) => a.name.localeCompare(b.name));
}

export interface ExerciseSourceCounts {
  all: number;
  builtin: number;
  mine: number;
  friends: number;
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
export async function fetchExerciseSourceCounts(
  userId: string,
  shared: ExerciseRow[] = [],
): Promise<ExerciseSourceCounts> {
  const base = await fetchFullExerciseList(userId);
  let builtin = 0;
  let mine = 0;
  for (const row of base) {
    if (row.createdBy === null) builtin += 1;
    else if (row.createdBy === userId) mine += 1;
  }
  const friends = shared.filter((row) => row.shared?.source === 'friend').length;
  // A trainer's or client's, in All -- less any already theirs.
  const linked = shared.filter(
    (row) => row.shared?.source !== 'friend' && !row.shared?.inLibrary,
  ).length;
  return { all: builtin + mine + linked, builtin, mine, friends };
}

/** What an exercise's own pages show at their top, as its library row does. */
export interface ExerciseDetails extends Required<MachineDetails> {
  muscleGroup: MuscleGroup;
  movementType: MovementType;
}

/**
 * One exercise's muscle, movement, photo, gym and handle, for the top of its own pages
 * (Progress's exercise page, PR History, its trend). From the library's cache when that's
 * already been read; otherwise read -- an exercise since deleted (deactivated) keeps its pages,
 * and its history, so it's read by id whether or not it's active. Null when it can't be seen.
 */
export async function fetchExerciseDetails(
  userId: string,
  exerciseId: string,
): Promise<ExerciseDetails | null> {
  const cached = fullExerciseListCache.get(userId)?.find((row) => row.id === exerciseId);
  if (cached) {
    return {
      muscleGroup: cached.muscleGroup,
      movementType: cached.movementType,
      photoUrl: cached.photoUrl,
      gym: cached.gym ?? null,
      attachment: cached.attachment ?? null,
      loadType: cached.loadType ?? null,
      pulley: cached.pulley ?? null,
      equipment: cached.equipment ?? null,
      grip: cached.grip ?? null,
      pulleyPosition: cached.pulleyPosition ?? null,
    };
  }
  const { data, error } = await supabase
    .from('exercises')
    .select(`muscle_group, movement_type, ${MACHINE_COLUMNS}`)
    .eq('id', exerciseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as {
    muscle_group: MuscleGroup;
    movement_type: MovementType;
    photo_url: string | null;
    gym: string | null;
    attachment: string | null;
    load_type: LoadType | null;
    pulley: Pulley | null;
    equipment: Equipment | null;
    grip: string | null;
    pulley_position: PulleyPosition | null;
  };
  return {
    muscleGroup: row.muscle_group,
    movementType: row.movement_type,
    ...machineDetailsOf(row),
  };
}

/**
 * How many workouts this person has logged an exercise in -- before changing its setup, so they
 * can keep that history on the setup it was logged with.
 */
export async function countLoggedWorkouts(userId: string, exerciseId: string): Promise<number> {
  const { count, error } = await supabase
    .from('workout_exercises')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
