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
  };
}

const FOOD_COLUMNS =
  'id, name, brand, barcode, image_url, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, is_active';

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
    query = query.ilike('name', `%${trimmedSearch}%`);
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
    query = query.ilike('name', `%${trimmedSearch}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as FoodDbRow[]).map(toFoodRow);
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
}

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
