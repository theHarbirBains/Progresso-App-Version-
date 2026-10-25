import { fetchAllRows } from '../lib/fetchAllRows';
import { supabase } from '../lib/supabase';
import { calculateLogTotals, recalculateForQuantity } from './nutritionCalculations';
import type { QuantityUnit } from './logQuantity';
import type { MealType } from './mealTypes';
import { PROVENANCE_COLUMNS, provenanceToColumns, USER_ENTERED, type FoodRow } from './foodQueries';

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
  /** Null for any log written before the food_log_meals_and_images migration -- never guessed. */
  mealType: MealType | null;
  loggedAt: string;
  /** The amount as typed ("2" cookies) and its unit; null for logs made before they were kept, which show servings. */
  enteredAmount?: number | null;
  enteredUnit?: QuantityUnit | null;
  /** The serving's own wording when logged ("3 cookies (34 g)"), so pieces can be counted again. */
  servingLabel?: string | null;
  /** The food's photo as it is now -- a presentation detail, not part of the nutrition snapshot. Only loaded for today's list; null when the food has none (or was deleted). */
  imageUrl?: string | null;
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
  meal_type: string | null;
  logged_at: string;
  entered_amount: string | number | null;
  entered_unit: string | null;
  serving_label: string | null;
  // A to-one embed comes back as an object; the client's inferred type says array, so both are read.
  foods?: { image_url: string | null } | { image_url: string | null }[] | null;
}

function embeddedImageUrl(foods: FoodLogDbRow['foods']): string | null {
  const food = Array.isArray(foods) ? foods[0] : foods;
  return food?.image_url ?? null;
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
    mealType: row.meal_type as MealType | null,
    loggedAt: row.logged_at,
    enteredAmount: row.entered_amount == null ? null : Number(row.entered_amount),
    enteredUnit: (row.entered_unit as QuantityUnit | null) ?? null,
    servingLabel: row.serving_label ?? null,
    ...(row.foods !== undefined ? { imageUrl: embeddedImageUrl(row.foods) } : {}),
  };
}

const FOOD_LOG_COLUMNS =
  'id, food_id, food_name_snapshot, serving_size, serving_unit, quantity, calories, protein_g, carbs_g, fat_g, meal_type, logged_at, entered_amount, entered_unit, serving_label';

// Today's list also shows each food's picture, read through the food_id link
// rather than copied into the log.
const TODAYS_FOOD_LOG_COLUMNS = `${FOOD_LOG_COLUMNS}, foods(image_url)`;

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
    .select(TODAYS_FOOD_LOG_COLUMNS)
    .eq('user_id', userId)
    .gte('logged_at', start.toISOString())
    .lt('logged_at', end.toISOString())
    .order('logged_at', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as FoodLogDbRow[]).map(toFoodLogRow);
}

/**
 * Every food log within the given local-time calendar month -- same
 * single-month-boundary pattern as workoutQueries.ts's own
 * fetchWorkoutsForMonth, so Nutrition History's calendar dots and its
 * selected day's list both derive from one fetch per month shown, the same
 * way Workout History already does (see WorkoutHistoryScreen's own
 * markedDateKeys/selectedDayWorkouts, both built from monthWorkouts).
 */
export async function fetchFoodLogsForMonth(
  userId: string,
  year: number,
  month: number,
): Promise<FoodLogRow[]> {
  const startOfMonth = new Date(year, month - 1, 1).toISOString();
  const startOfNextMonth = new Date(year, month, 1).toISOString();

  const { data, error } = await supabase
    .from('food_logs')
    .select(TODAYS_FOOD_LOG_COLUMNS)
    .eq('user_id', userId)
    .gte('logged_at', startOfMonth)
    .lt('logged_at', startOfNextMonth)
    .order('logged_at', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as FoodLogDbRow[]).map(toFoodLogRow);
}

/** An amount as typed, beside the servings it comes to. */
export interface EnteredAmount {
  amount: number;
  unit: QuantityUnit;
}

/** Logs `quantity` servings of `food` now, under `mealType`. Snapshot totals are computed once, at log time, and stored -- never re-derived from foods afterward. */
export async function logFood(
  userId: string,
  food: Pick<
    FoodRow,
    | 'id'
    | 'name'
    | 'servingSize'
    | 'servingUnit'
    | 'calories'
    | 'proteinG'
    | 'carbsG'
    | 'fatG'
    | 'provenance'
  > & { servingLabel?: string | null },
  quantity: number,
  mealType: MealType,
  entered?: EnteredAmount | null,
  /** When it was eaten, for a past day (nutrition/logDay.ts); now when omitted. */
  loggedAt?: Date,
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
      meal_type: mealType,
      entered_amount: entered?.amount ?? null,
      entered_unit: entered?.unit ?? null,
      serving_label: food.servingLabel ?? null,
      ...(loggedAt ? { logged_at: loggedAt.toISOString() } : {}),
      // The log keeps the figures' provenance as it was at logging time, even if the library food changes later.
      ...provenanceToColumns(food.provenance),
    })
    .select(FOOD_LOG_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toFoodLogRow(data as FoodLogDbRow);
}

/** A quick entry: a name and the figures the person typed, with no food behind it. */
export interface QuickEntry {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Logs a quick entry as one serving of itself: no food in the library (food_id stays null), its
 * figures marked as the person's own, not checked against any food data.
 */
export async function logQuickEntry(
  userId: string,
  entry: QuickEntry,
  mealType: MealType,
  loggedAt?: Date,
): Promise<FoodLogRow> {
  const { data, error } = await supabase
    .from('food_logs')
    .insert({
      user_id: userId,
      food_id: null,
      food_name_snapshot: entry.name,
      serving_size: 1,
      serving_unit: 'serving',
      quantity: 1,
      calories: entry.calories,
      protein_g: entry.proteinG,
      carbs_g: entry.carbsG,
      fat_g: entry.fatG,
      meal_type: mealType,
      ...(loggedAt ? { logged_at: loggedAt.toISOString() } : {}),
      ...provenanceToColumns(USER_ENTERED),
    })
    .select(FOOD_LOG_COLUMNS)
    .single();

  if (error) throw new Error(error.message);
  return toFoodLogRow(data as FoodLogDbRow);
}

/** Recomputes from the log's own existing snapshot (never re-reads foods) and persists the new quantity + totals -- and the amount as typed, when it was typed in a unit. */
export async function updateFoodLogQuantity(
  log: FoodLogRow,
  newQuantity: number,
  entered?: EnteredAmount | null,
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
      ...(entered !== undefined
        ? { entered_amount: entered?.amount ?? null, entered_unit: entered?.unit ?? null }
        : {}),
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

/** Every food log on the local calendar day that `day` falls on, oldest first. */
export async function fetchFoodLogsForDay(userId: string, day: Date): Promise<FoodLogRow[]> {
  const { start, end } = getLocalDayRange(day);
  const { data, error } = await supabase
    .from('food_logs')
    .select(TODAYS_FOOD_LOG_COLUMNS)
    .eq('user_id', userId)
    .gte('logged_at', start.toISOString())
    .lt('logged_at', end.toISOString())
    .order('logged_at', { ascending: true });
  if (error) throw new Error(error.message);
  return ((data ?? []) as FoodLogDbRow[]).map(toFoodLogRow);
}

/**
 * Every food log from `start` up to (not including) `end`, oldest first -- a week's, for its
 * calorie budget and its summary. A week's logs are a few dozen rows, well inside one read.
 */
export async function fetchFoodLogsForRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<FoodLogRow[]> {
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

/** A food log's time and figures, for Progress's nutrition. */
export interface Intake {
  loggedAt: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Each food log's time and figures from `start` up to (not including) `end` -- a week, or every
 * log there is -- read a page at a time, so a long range is read in full.
 */
export async function fetchIntakeForRange(
  userId: string,
  start: Date,
  end: Date,
): Promise<Intake[]> {
  const rows = await fetchAllRows<{
    logged_at: string;
    calories: string | number;
    protein_g: string | number;
    carbs_g: string | number;
    fat_g: string | number;
  }>((from, to) =>
    supabase
      .from('food_logs')
      .select('logged_at, calories, protein_g, carbs_g, fat_g', { count: 'exact' })
      .eq('user_id', userId)
      .gte('logged_at', start.toISOString())
      .lt('logged_at', end.toISOString())
      .order('logged_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, to),
  );
  return rows.map((row) => ({
    loggedAt: row.logged_at,
    calories: Number(row.calories),
    proteinG: Number(row.protein_g),
    carbsG: Number(row.carbs_g),
    fatG: Number(row.fat_g),
  }));
}

// Everything a log snapshots, so a copy is exactly what was logged.
const COPIED_COLUMNS = `food_id, food_name_snapshot, serving_size, serving_unit, quantity, calories, protein_g, carbs_g, fat_g, meal_type, entered_amount, entered_unit, serving_label, ${PROVENANCE_COLUMNS}`;

/**
 * Logs these past logs again, now: each copy is exactly what was logged then -- the same
 * amounts, figures and provenance -- never re-read from the food, which may have changed since.
 * Returns the new logs, in the order given.
 */
export async function copyFoodLogs(userId: string, logIds: string[]): Promise<FoodLogRow[]> {
  if (logIds.length === 0) return [];
  const { data: sources, error } = await supabase
    .from('food_logs')
    .select(`id, ${COPIED_COLUMNS}`)
    .eq('user_id', userId)
    .in('id', logIds);
  if (error) throw new Error(error.message);

  const byId = new Map(((sources ?? []) as Record<string, unknown>[]).map((row) => [row.id, row]));
  const now = Date.now();
  const copies = logIds
    .map((id) => byId.get(id))
    .filter((row): row is Record<string, unknown> => row !== undefined)
    .map((row, index) => {
      const copy: Record<string, unknown> = { ...row, user_id: userId };
      delete copy.id;
      // A millisecond apart, so they keep their order in Today's list.
      copy.logged_at = new Date(now + index).toISOString();
      return copy;
    });
  if (copies.length === 0) return [];

  const { data, error: insertError } = await supabase
    .from('food_logs')
    .insert(copies)
    .select(TODAYS_FOOD_LOG_COLUMNS);
  if (insertError) throw new Error(insertError.message);
  return ((data ?? []) as FoodLogDbRow[])
    .map(toFoodLogRow)
    .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt));
}
