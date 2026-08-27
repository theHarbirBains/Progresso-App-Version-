import { supabase } from '../lib/supabase';
import { calculateLogTotals, recalculateForQuantity } from './nutritionCalculations';
import type { FoodRow } from './foodQueries';

// Direct-to-Supabase, same reasoning as foodQueries.ts: food_logs is
// entirely own-row RLS with a real delete policy (no PR-style derived
// state depends on soft-delete here), and logging is simple arithmetic
// over the user's own data -- not a cross-user-trusted computation like PR
// recomputation, so there's no business logic here for a backend endpoint
// to centralize.
export interface FoodLogRow {
  id: string;
  foodId: string | null;
  foodNameSnapshot: string;
  servingSize: number;
  servingUnit: string;
  quantity: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  loggedAt: string;
}

interface FoodLogDbRow {
  id: string;
  food_id: string | null;
  food_name_snapshot: string;
  serving_size: string | number;
  serving_unit: string;
  quantity: string | number;
  calories: string | number;
  protein_g: string | number;
  carbs_g: string | number;
  fat_g: string | number;
  logged_at: string;
}

function toFoodLogRow(row: FoodLogDbRow): FoodLogRow {
  return {
    id: row.id,
    foodId: row.food_id,
    foodNameSnapshot: row.food_name_snapshot,
    servingSize: Number(row.serving_size),
    servingUnit: row.serving_unit,
    quantity: Number(row.quantity),
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
    loggedAt: row.logged_at,
  };
}

const FOOD_LOG_COLUMNS =
  'id, food_id, food_name_snapshot, serving_size, serving_unit, quantity, calories, protein_g, carbs_g, fat_g, logged_at';

/**
 * The current device's local calendar day as an absolute [start, end)
 * instant range -- "today" means the user's own day, not a UTC day. Date's
 * getFullYear/getMonth/getDate/setHours-style constructor args are always
 * evaluated in the device's local timezone, which is what we want here.
 */
export function getLocalDayRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return { start, end };
}

export async function fetchTodaysFoodLogs(
  userId: string,
  now: Date = new Date(),
): Promise<FoodLogRow[]> {
  const { start, end } = getLocalDayRange(now);

  const { data, error } = await supabase
    .from('food_logs')
    .select(FOOD_LOG_COLUMNS)
    .eq('user_id', userId)
    .gte('logged_at', start.toISOString())
    .lt('logged_at', end.toISOString())
    .order('logged_at', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as FoodLogDbRow[]).map(toFoodLogRow);
}

/** Logs `quantity` servings of `food` now. Snapshot totals are computed once, at log time, and stored -- never re-derived from foods afterward. */
export async function logFood(
  userId: string,
  food: Pick<
    FoodRow,
    'id' | 'name' | 'servingSize' | 'servingUnit' | 'calories' | 'proteinG' | 'carbsG' | 'fatG'
  >,
  quantity: number,
): Promise<FoodLogRow> {
  const totals = calculateLogTotals(food, quantity);

  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      user_id: userId,
      food_id: food.id,
      food_name_snapshot: food.name,
      serving_size: food.servingSize,
      serving_unit: food.servingUnit,
      quantity,
      calories: totals.calories,
      protein_g: totals.proteinG,
      carbs_g: totals.carbsG,
      fat_g: totals.fatG,
    })
    .select(FOOD_LOG_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toFoodLogRow(data as FoodLogDbRow);
}

/** Recomputes from the log's own existing snapshot (never re-reads foods) and persists the new quantity + totals. */
export async function updateFoodLogQuantity(
  log: FoodLogRow,
  newQuantity: number,
): Promise<FoodLogRow> {
  const totals = recalculateForQuantity(log, newQuantity);

  const { data, error } = await supabase
    .from('food_logs')
    .update({
      quantity: newQuantity,
      calories: totals.calories,
      protein_g: totals.proteinG,
      carbs_g: totals.carbsG,
      fat_g: totals.fatG,
    })
    .eq('id', log.id)
    .select(FOOD_LOG_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toFoodLogRow(data as FoodLogDbRow);
}

export async function deleteFoodLog(logId: string): Promise<void> {
  const { error } = await supabase.from('food_logs').delete().eq('id', logId);
  if (error) throw new Error(error.message);
}
