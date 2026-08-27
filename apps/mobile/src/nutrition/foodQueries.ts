import { supabase } from '../lib/supabase';

// Phase 6: there are no built-in foods yet (created_by is null is reserved
// for a future phase) -- every row returned here belongs to the querying
// user. Direct-to-Supabase reads/writes, same as workouts/exercises: RLS
// already restricts foods to created_by = auth.uid(), and there is no
// unique-name constraint on this table (unlike exercises) to justify
// routing writes through the backend for collision handling.
export interface FoodRow {
  id: string;
  name: string;
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
    servingSize: Number(row.serving_size),
    servingUnit: row.serving_unit,
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    isActive: row.is_active,
  };
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
    .select('id, name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, is_active')
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

export interface FoodInput {
  name: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export async function createFood(userId: string, input: FoodInput): Promise<FoodRow> {
  const { data, error } = await supabase
    .from('foods')
    .insert({
      created_by: userId,
      name: input.name,
      serving_size: input.servingSize,
      serving_unit: input.servingUnit,
      calories: input.calories,
      protein_g: input.proteinG,
      carbs_g: input.carbsG,
      fat_g: input.fatG,
    })
    .select('id, name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, is_active')
    .single();

  if (error) throw new Error(error.message);
  return toFoodRow(data as FoodDbRow);
}

export type UpdateFoodInput = Partial<FoodInput> & { isActive?: boolean };

export async function updateFood(foodId: string, input: UpdateFoodInput): Promise<FoodRow> {
  const payload: Record<string, unknown> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.servingSize !== undefined) payload.serving_size = input.servingSize;
  if (input.servingUnit !== undefined) payload.serving_unit = input.servingUnit;
  if (input.calories !== undefined) payload.calories = input.calories;
  if (input.proteinG !== undefined) payload.protein_g = input.proteinG;
  if (input.carbsG !== undefined) payload.carbs_g = input.carbsG;
  if (input.fatG !== undefined) payload.fat_g = input.fatG;
  if (input.isActive !== undefined) payload.is_active = input.isActive;

  const { data, error } = await supabase
    .from('foods')
    .update(payload)
    .eq('id', foodId)
    .select('id, name, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, is_active')
    .single();

  if (error) throw new Error(error.message);
  return toFoodRow(data as FoodDbRow);
}
