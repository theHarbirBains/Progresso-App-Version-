import { supabase } from '../lib/supabase';
import type { FoodGroupItem } from './foodGroups';
import { FOOD_COLUMNS, foodFromRow } from './foodQueries';
import type { QuantityUnit } from './logQuantity';

// A saved meal is foods eaten together, each with its amount -- logged in one go, each food
// as its own entry (see FoodLogProvider's logFoodEntries). Direct-to-Supabase, own rows only:
// saved_meal_items' user_id is set by trigger to the meal's owner, and an item can only be a
// food the owner can see (their own, or the shared catalog).

export interface SavedMeal {
  id: string;
  name: string;
  /** In the order they were added. Each food as it is now, so a deactivated one can be skipped. */
  items: FoodGroupItem[];
}

/** One stored item -- a saved meal's or a recipe's -- and its food. */
export interface ItemDbRow {
  id: string;
  position: number;
  quantity: string | number;
  entered_amount: string | number | null;
  entered_unit: QuantityUnit | null;
  // A to-one embed comes back as an object; the client's inferred type says array, so both are read.
  food: unknown;
}

/** Stored items, in order, as FoodGroupItems -- an item whose food can't be read is left out. */
export function itemsFromRows(rows: ItemDbRow[]): FoodGroupItem[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .flatMap((row) => {
      const food = Array.isArray(row.food) ? row.food[0] : row.food;
      if (!food) return [];
      return [
        {
          food: foodFromRow(food),
          quantity: Number(row.quantity),
          entered:
            row.entered_amount === null || !row.entered_unit
              ? null
              : { amount: Number(row.entered_amount), unit: row.entered_unit },
        },
      ];
    });
}

/** The columns an item is stored with, in the order given. */
export function itemColumns(items: FoodGroupItem[]) {
  return items.map((item, position) => ({
    food_id: item.food.id,
    position,
    quantity: item.quantity,
    entered_amount: item.entered?.amount ?? null,
    entered_unit: item.entered?.unit ?? null,
  }));
}

export const ITEM_COLUMNS = `id, position, quantity, entered_amount, entered_unit, food:foods(${FOOD_COLUMNS})`;

/** The user's saved meals, by name. */
export async function fetchSavedMeals(userId: string): Promise<SavedMeal[]> {
  const { data, error } = await supabase
    .from('saved_meals')
    .select(`id, name, saved_meal_items(${ITEM_COLUMNS})`)
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw new Error(error.message);
  type MealDbRow = { id: string; name: string; saved_meal_items: ItemDbRow[] | null };
  return ((data ?? []) as unknown as MealDbRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    items: itemsFromRows(row.saved_meal_items ?? []),
  }));
}

async function insertItems(userId: string, mealId: string, items: FoodGroupItem[]) {
  if (items.length === 0) throw new Error('Add at least one food');
  const { data, error } = await supabase
    .from('saved_meal_items')
    .insert(
      itemColumns(items).map((columns) => ({
        ...columns,
        saved_meal_id: mealId,
        user_id: userId,
      })),
    )
    .select('id');
  if (error) throw new Error(error.message);
  return ((data ?? []) as { id: string }[]).map((row) => row.id);
}

/** Saves a new meal with its foods. */
export async function createSavedMeal(
  userId: string,
  name: string,
  items: FoodGroupItem[],
): Promise<SavedMeal> {
  if (items.length === 0) throw new Error('Add at least one food');
  const { data, error } = await supabase
    .from('saved_meals')
    .insert({ user_id: userId, name: name.trim() })
    .select('id, name')
    .single();
  if (error) throw new Error(error.message);
  const meal = data as { id: string; name: string };
  try {
    await insertItems(userId, meal.id, items);
  } catch (err) {
    // A meal with none of its foods is no use: take it away again.
    await supabase.from('saved_meals').delete().eq('id', meal.id);
    throw err;
  }
  return { id: meal.id, name: meal.name, items };
}

/**
 * Renames a meal and replaces its foods. The new foods go in before the old ones come out,
 * so a failure part way never leaves the meal empty.
 */
export async function updateSavedMeal(
  userId: string,
  mealId: string,
  name: string,
  items: FoodGroupItem[],
): Promise<SavedMeal> {
  const kept = await insertItems(userId, mealId, items);
  const { error: removeError } = await supabase
    .from('saved_meal_items')
    .delete()
    .eq('saved_meal_id', mealId)
    .not('id', 'in', `(${kept.join(',')})`);
  if (removeError) throw new Error(removeError.message);
  const { error } = await supabase
    .from('saved_meals')
    .update({ name: name.trim() })
    .eq('id', mealId);
  if (error) throw new Error(error.message);
  return { id: mealId, name: name.trim(), items };
}

/** Deletes a meal and its list of foods. Foods already logged from it stay logged. */
export async function deleteSavedMeal(mealId: string): Promise<void> {
  const { error } = await supabase.from('saved_meals').delete().eq('id', mealId);
  if (error) throw new Error(error.message);
}
