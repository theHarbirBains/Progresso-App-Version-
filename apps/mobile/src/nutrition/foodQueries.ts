import { compareByName } from '../lib/alphabeticalGrouping';
import { fetchAllRows } from '../lib/fetchAllRows';
import { escapeIlike } from '../lib/ilike';
import { supabase } from '../lib/supabase';
import type { QuantityUnit } from './logQuantity';

// fetchFoods/fetchAllFoods/createFood/updateFood are the user's own custom
// foods (created_by = the querying user) -- direct-to-Supabase, same as
// workouts/exercises: RLS already restricts foods to created_by =
// auth.uid(), and there is no unique-name constraint on this table (unlike
// exercises) to justify routing writes through the backend for collision
// handling. Searching the built-in/cached-external catalog (created_by is
// null) now goes through the backend's /foods/search endpoint instead (see
// lib/api.ts's searchFoods) -- that search combines this table with a live
// external food-data provider, which is real orchestration/business logic,
// not a simple RLS-protected read.
export interface FoodRow {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  /** A cached provider product's photo, or the one the user added to their own custom food. Null when there is none. */
  imageUrl: string | null;
  servingSize: number;
  servingUnit: string;
  /** A provider product's own wording of its serving ("3 cookies (34 g)"); null for the user's own foods and seeded ones. */
  servingLabel?: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isActive: boolean;
  /** Where this food's nutrition came from. Null for foods that predate provenance, or without it. */
  provenance?: FoodProvenance | null;
  /** Set when the food is one of the user's recipes: how many servings the recipe makes. */
  recipeServings?: number | null;
}

/**
 * The provenance a library food and each of its logs keep: where the figures came from, whether
 * they were verified or calculated, what was matched, the data version, and the assumptions made.
 */
export interface FoodProvenance {
  confidence: 'verified' | 'calculated' | 'ai_estimate' | 'user_entered';
  sourceKind: string | null;
  sourceId: string | null;
  matchedName: string | null;
  dataVersion: string | null;
  retrievedAt: string | null;
  licence: string | null;
  attribution: string | null;
  assumptions: string[];
  /** For a food built from several components: each component's own figures and provenance. */
  components: unknown[] | null;
}

interface FoodDbRow {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  image_url: string | null;
  serving_size: string | number;
  serving_unit: string;
  serving_label: string | null;
  calories: string | number;
  protein_g: string | number;
  carbs_g: string | number;
  fat_g: string | number;
  is_active: boolean;
  nutrition_confidence: FoodProvenance['confidence'] | null;
  nutrition_source_kind: string | null;
  nutrition_source_id: string | null;
  nutrition_matched_name: string | null;
  nutrition_data_version: string | null;
  nutrition_retrieved_at: string | null;
  nutrition_licence: string | null;
  nutrition_attribution: string | null;
  nutrition_assumptions: string[] | null;
  nutrition_components: unknown[] | null;
  recipe_servings?: string | number | null;
}

/** The provenance columns, shared by foods and food logs. */
export const PROVENANCE_COLUMNS =
  'nutrition_confidence, nutrition_source_kind, nutrition_source_id, nutrition_matched_name, nutrition_data_version, nutrition_retrieved_at, nutrition_licence, nutrition_attribution, nutrition_assumptions, nutrition_components';

function provenanceFromRow(row: FoodDbRow): FoodProvenance | null {
  if (row.nutrition_confidence === null || row.nutrition_confidence === undefined) return null;
  return {
    confidence: row.nutrition_confidence,
    sourceKind: row.nutrition_source_kind,
    sourceId: row.nutrition_source_id,
    matchedName: row.nutrition_matched_name,
    dataVersion: row.nutrition_data_version,
    retrievedAt: row.nutrition_retrieved_at,
    licence: row.nutrition_licence,
    attribution: row.nutrition_attribution,
    assumptions: row.nutrition_assumptions ?? [],
    components: row.nutrition_components,
  };
}

/** The provenance as the columns a food or a log stores. Null everywhere when there is none. */
export function provenanceToColumns(provenance: FoodProvenance | null | undefined) {
  return {
    nutrition_confidence: provenance?.confidence ?? null,
    nutrition_source_kind: provenance?.sourceKind ?? null,
    nutrition_source_id: provenance?.sourceId ?? null,
    nutrition_matched_name: provenance?.matchedName ?? null,
    nutrition_data_version: provenance?.dataVersion ?? null,
    nutrition_retrieved_at: provenance?.retrievedAt ?? null,
    nutrition_licence: provenance?.licence ?? null,
    nutrition_attribution: provenance?.attribution ?? null,
    nutrition_assumptions: provenance?.assumptions ?? [],
    nutrition_components: provenance?.components ?? null,
  };
}

function toFoodRow(row: FoodDbRow): FoodRow {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    barcode: row.barcode,
    imageUrl: row.image_url,
    servingSize: Number(row.serving_size),
    servingUnit: row.serving_unit,
    // Empty means the provider had no wording (see the serving_label migration).
    servingLabel: row.serving_label || null,
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    isActive: row.is_active,
    provenance: provenanceFromRow(row),
    recipeServings:
      row.recipe_servings === null || row.recipe_servings === undefined
        ? null
        : Number(row.recipe_servings),
  };
}

export const FOOD_COLUMNS = `id, name, brand, barcode, image_url, serving_size, serving_unit, serving_label, calories, protein_g, carbs_g, fat_g, is_active, recipe_servings, ${PROVENANCE_COLUMNS}`;

/** A food read through a log, a meal item or an ingredient -- as a FoodRow. */
export function foodFromRow(row: unknown): FoodRow {
  return toFoodRow(row as FoodDbRow);
}

export interface FetchFoodsParams {
  userId: string;
  search: string;
  page: number;
  pageSize: number;
}

export interface FetchFoodsResult {
  rows: FoodRow[];
  hasMore: boolean;
}

export async function fetchFoods(params: FetchFoodsParams): Promise<FetchFoodsResult> {
  const { userId, search, page, pageSize } = params;

  let query = supabase
    .from('foods')
    .select(FOOD_COLUMNS)
    .eq('created_by', userId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    query = query.ilike('name', `%${escapeIlike(trimmedSearch)}%`);
  }

  const from = page * pageSize;
  const to = from + pageSize - 1;
  const { data, error } = await query.range(from, to);

  if (error) throw new Error(error.message);

  const rows = ((data ?? []) as FoodDbRow[]).map(toFoodRow);
  return { rows, hasMore: rows.length === pageSize };
}

export interface FetchAllFoodsParams {
  userId: string;
  search: string;
  ascending: boolean;
}

/**
 * The Food Library screen's data source -- unlike fetchFoods above (which
 * pages a scrollable list), this loads every one of the user's own foods at
 * once, since grouping them into an alphabetical, indexed list (like iOS
 * Contacts) needs the whole set up front rather than one page at a time.
 * Safe to load in full: this is one user's own personal food collection,
 * not the shared/searchable catalog.
 */
export async function fetchAllFoods(params: FetchAllFoodsParams): Promise<FoodRow[]> {
  const { userId, search, ascending } = params;

  let query = supabase
    .from('foods')
    .select(FOOD_COLUMNS)
    .eq('created_by', userId)
    .eq('is_active', true)
    .order('name', { ascending });

  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    query = query.ilike('name', `%${escapeIlike(trimmedSearch)}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // A to Z ignoring case, numbers and symbols first (compareByName) -- whatever the database's
  // collation orders capitals by.
  const direction = ascending ? 1 : -1;
  return ((data ?? []) as FoodDbRow[])
    .map(toFoodRow)
    .sort((a, b) => direction * compareByName(a.name, b.name));
}

export interface RecentFood {
  food: FoodRow;
  /** The quantity logged last time, in servings. */
  quantity: number;
  /** The amount as typed last time ("150" g), when it was kept. */
  entered?: { amount: number; unit: QuantityUnit } | null;
}

function enteredFrom(
  amount: string | number | null | undefined,
  unit: QuantityUnit | null | undefined,
): RecentFood['entered'] {
  return amount === null || amount === undefined || !unit ? null : { amount: Number(amount), unit };
}

// How many of the user's latest logs Recent looks through for its foods.
const RECENT_LOGS_SCANNED = 50;

/**
 * The foods the user logged most recently, newest first, one entry per food, each with the
 * quantity logged last time -- Log Food's Recent list. Read from the user's own logs through
 * each log's food, so a food logged from Search or a scan is included as well as library foods.
 * A food that is gone or deactivated is left out: logging it again needs the food itself.
 */
export async function fetchRecentFoods(userId: string, limit = 8): Promise<RecentFood[]> {
  const { data, error } = await supabase
    .from('food_logs')
    .select(`food_id, quantity, entered_amount, entered_unit, foods(${FOOD_COLUMNS})`)
    .eq('user_id', userId)
    .not('food_id', 'is', null)
    .order('logged_at', { ascending: false })
    .limit(RECENT_LOGS_SCANNED);
  if (error) throw new Error(error.message);

  type RecentLogRow = {
    food_id: string;
    quantity: string | number;
    entered_amount?: string | number | null;
    entered_unit?: QuantityUnit | null;
    // A to-one embed comes back as an object; the client's inferred type says array, so both are read.
    foods: FoodDbRow | FoodDbRow[] | null;
  };
  const recent: RecentFood[] = [];
  const seen = new Set<string>();
  for (const row of (data ?? []) as unknown as RecentLogRow[]) {
    if (recent.length === limit) break;
    if (seen.has(row.food_id)) continue;
    seen.add(row.food_id);
    const food = Array.isArray(row.foods) ? row.foods[0] : row.foods;
    if (!food || !food.is_active) continue;
    recent.push({
      food: toFoodRow(food),
      quantity: Number(row.quantity),
      entered: enteredFrom(row.entered_amount, row.entered_unit),
    });
  }
  return recent;
}

/** How far back Usual looks, in days. */
export const USUAL_WINDOW_DAYS = 60;
/** A food is usual once it's been logged on at least this many different days. */
const USUAL_MIN_DAYS = 2;

/**
 * The foods the user logs most often -- on the most different days in the last 60, at least
 * two -- each with last time's amount: the Food Library's Usual list. Days, not logs, so three
 * eggs logged as three entries one morning count once. Ties go to the one logged most recently.
 * A food that is gone or deactivated is left out, like Recent.
 */
export async function fetchUsualFoods(
  userId: string,
  limit = 6,
  now: Date = new Date(),
): Promise<RecentFood[]> {
  const since = new Date(now.getTime() - USUAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  type UsualLogRow = {
    food_id: string;
    logged_at: string;
    quantity: string | number;
    entered_amount: string | number | null;
    entered_unit: QuantityUnit | null;
  };
  const logs = await fetchAllRows<UsualLogRow>((from, to) =>
    supabase
      .from('food_logs')
      .select('food_id, logged_at, quantity, entered_amount, entered_unit', { count: 'exact' })
      .eq('user_id', userId)
      .not('food_id', 'is', null)
      .gte('logged_at', since.toISOString())
      .order('logged_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, to),
  );

  // Newest first, so each food's first row is its latest log.
  const byFood = new Map<string, { days: Set<string>; latest: UsualLogRow }>();
  for (const log of logs) {
    const at = new Date(log.logged_at);
    const day = `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
    const entry = byFood.get(log.food_id);
    if (entry) entry.days.add(day);
    else byFood.set(log.food_id, { days: new Set([day]), latest: log });
  }
  const ranked = [...byFood.values()]
    .filter((entry) => entry.days.size >= USUAL_MIN_DAYS)
    .sort(
      (a, b) =>
        b.days.size - a.days.size ||
        Date.parse(b.latest.logged_at) - Date.parse(a.latest.logged_at),
    );
  if (ranked.length === 0) return [];

  // A few spare, in case some are no longer active.
  const candidates = ranked.slice(0, limit * 2);
  const { data, error } = await supabase
    .from('foods')
    .select(FOOD_COLUMNS)
    .in(
      'id',
      candidates.map((entry) => entry.latest.food_id),
    );
  if (error) throw new Error(error.message);
  const foods = new Map(((data ?? []) as FoodDbRow[]).map((row) => [row.id, row]));

  const usual: RecentFood[] = [];
  for (const { latest } of candidates) {
    if (usual.length === limit) break;
    const food = foods.get(latest.food_id);
    if (!food || !food.is_active) continue;
    usual.push({
      food: toFoodRow(food),
      quantity: Number(latest.quantity),
      entered: enteredFrom(latest.entered_amount, latest.entered_unit),
    });
  }
  return usual;
}

/** These foods as they are now, in no particular order -- one missing (or unseen) is left out. */
export async function fetchFoodsByIds(ids: string[]): Promise<FoodRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('foods').select(FOOD_COLUMNS).in('id', ids);
  if (error) throw new Error(error.message);
  return ((data ?? []) as FoodDbRow[]).map(toFoodRow);
}

/**
 * The user's own active food with exactly this name (case-insensitive, trimmed),
 * or null. Used to stop AI Food Search adding a second copy of a food the
 * library already has. Exact match, not a substring search: "Potato" must not
 * be treated as already having "Sweet Potato".
 */
export async function findOwnFoodByName(userId: string, name: string): Promise<FoodRow | null> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;
  const { data, error } = await supabase
    .from('foods')
    .select(FOOD_COLUMNS)
    .eq('created_by', userId)
    .eq('is_active', true)
    .ilike('name', escapeIlike(name.trim()));
  if (error) throw new Error(error.message);
  const match = ((data ?? []) as FoodDbRow[])
    .map(toFoodRow)
    .find((food) => food.name.trim().toLowerCase() === wanted);
  return match ?? null;
}

export interface FoodInput {
  name: string;
  /** Optional -- most custom foods have no brand. */
  brand?: string | null;
  /** Optional -- a custom food never requires a barcode (see FoodFormScreen). */
  barcode?: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** A photo of the food (its uploaded URL). Omit to leave it alone; null clears it. */
  imageUrl?: string | null;
  /** The serving as a provider words it ("3 cookies (34 g)") -- kept by a logged food's copy. */
  servingLabel?: string | null;
  /** Where the figures came from. Omit for a food the user entered by hand. */
  provenance?: FoodProvenance | null;
  /** For a recipe: how many servings it makes. */
  recipeServings?: number | null;
}

/** A food the user typed in: its figures are the user's own, not from any data source. */
export const USER_ENTERED: FoodProvenance = {
  confidence: 'user_entered',
  sourceKind: 'user_entered',
  sourceId: null,
  matchedName: null,
  dataVersion: null,
  retrievedAt: null,
  licence: 'none',
  attribution: null,
  assumptions: [],
  components: null,
};

export async function createFood(userId: string, input: FoodInput): Promise<FoodRow> {
  const { data, error } = await supabase
    .from('foods')
    .insert({
      created_by: userId,
      name: input.name,
      brand: input.brand ?? null,
      barcode: input.barcode ?? null,
      serving_size: input.servingSize,
      serving_unit: input.servingUnit,
      calories: input.calories,
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
      ...(input.imageUrl !== undefined ? { image_url: input.imageUrl } : {}),
      ...(input.servingLabel !== undefined ? { serving_label: input.servingLabel } : {}),
      ...(input.recipeServings !== undefined ? { recipe_servings: input.recipeServings } : {}),
      ...provenanceToColumns(input.provenance === undefined ? USER_ENTERED : input.provenance),
    })
    .select(FOOD_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toFoodRow(data as FoodDbRow);
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
}

/**
 * The food a log should point at, kept in the user's Food Library: a food that is already theirs
 * is used as it is; any other -- a built-in, a searched or scanned product -- is copied into their
 * library the first time it's logged, keeping where its figures came from. A copy of theirs with
 * the same name, brand, serving and calories (or the same barcode) is used again, so logging the
 * same food twice never adds it twice. Null when the food can't be found to copy.
 */
export async function keepInLibrary(userId: string, foodId: string): Promise<FoodRow | null> {
  const { data: sourceData, error: sourceError } = await supabase
    .from('foods')
    .select(`created_by, ${FOOD_COLUMNS}`)
    .eq('id', foodId)
    .maybeSingle();
  if (sourceError) throw new Error(sourceError.message);
  if (!sourceData) return null;
  const sourceRow = sourceData as FoodDbRow & { created_by: string | null };
  const source = toFoodRow(sourceRow);
  if (sourceRow.created_by === userId) return source;

  const { data: ownData, error: ownError } = await supabase
    .from('foods')
    .select(FOOD_COLUMNS)
    .eq('created_by', userId)
    .eq('is_active', true)
    .ilike('name', escapeIlike(source.name.trim()));
  if (ownError) throw new Error(ownError.message);
  const copy = ((ownData ?? []) as FoodDbRow[])
    .map(toFoodRow)
    .find(
      (own) =>
        (source.barcode !== null && own.barcode === source.barcode) ||
        (sameText(own.name, source.name) &&
          sameText(own.brand, source.brand) &&
          own.servingSize === source.servingSize &&
          sameText(own.servingUnit, source.servingUnit) &&
          Math.round(own.calories) === Math.round(source.calories)),
    );
  if (copy) return copy;

  return createFood(userId, {
    name: source.name,
    brand: source.brand,
    barcode: source.barcode,
    servingSize: source.servingSize,
    servingUnit: source.servingUnit,
    servingLabel: source.servingLabel ?? null,
    calories: source.calories,
    proteinG: source.proteinG,
    carbsG: source.carbsG,
    fatG: source.fatG,
    imageUrl: source.imageUrl,
    provenance: source.provenance ?? null,
  });
}

export type UpdateFoodInput = Partial<FoodInput> & { isActive?: boolean };

export async function updateFood(foodId: string, input: UpdateFoodInput): Promise<FoodRow> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.brand !== undefined) payload.brand = input.brand;
  if (input.barcode !== undefined) payload.barcode = input.barcode;
  if (input.servingSize !== undefined) payload.serving_size = input.servingSize;
  if (input.servingUnit !== undefined) payload.serving_unit = input.servingUnit;
  if (input.calories !== undefined) payload.calories = input.calories;
  if (input.proteinG !== undefined) payload.protein_g = input.proteinG;
  if (input.carbsG !== undefined) payload.carbs_g = input.carbsG;
  if (input.fatG !== undefined) payload.fat_g = input.fatG;
  if (input.imageUrl !== undefined) payload.image_url = input.imageUrl;
  if (input.isActive !== undefined) payload.is_active = input.isActive;
  if (input.recipeServings !== undefined) payload.recipe_servings = input.recipeServings;
  // A recipe's figures are worked out again whenever it's saved, and so is where they came from.
  if (input.provenance !== undefined) Object.assign(payload, provenanceToColumns(input.provenance));

  const { data, error } = await supabase
    .from('foods')
    .update(payload)
    .eq('id', foodId)
    .select(FOOD_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toFoodRow(data as FoodDbRow);
}
