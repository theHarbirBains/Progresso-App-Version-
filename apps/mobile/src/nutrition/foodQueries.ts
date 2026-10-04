import { escapeIlike } from '../lib/ilike';
import { supabase } from '../lib/supabase';

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
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isActive: boolean;
  /** Where this food's nutrition came from. Null for foods that predate provenance, or without it. */
  provenance?: FoodProvenance | null;
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
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    isActive: row.is_active,
    provenance: provenanceFromRow(row),
  };
}

const FOOD_COLUMNS = `id, name, brand, barcode, image_url, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, is_active, ${PROVENANCE_COLUMNS}`;

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
  /** Where the figures came from. Omit for a food the user entered by hand. */
  provenance?: FoodProvenance | null;
}

/** A food the user typed in: its figures are the user's own, not from any data source. */
const USER_ENTERED: FoodProvenance = {
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
      ...provenanceToColumns(input.provenance === undefined ? USER_ENTERED : input.provenance),
    })
    .select(FOOD_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toFoodRow(data as FoodDbRow);
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

  const { data, error } = await supabase
    .from('foods')
    .update(payload)
    .eq('id', foodId)
    .select(FOOD_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toFoodRow(data as FoodDbRow);
}
