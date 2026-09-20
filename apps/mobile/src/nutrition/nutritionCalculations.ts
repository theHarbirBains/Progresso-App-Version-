import type { FoodLogRow } from './foodLogQueries';

// Pure, deterministic nutrition math -- no I/O, no Supabase, nothing
// estimated or invented. Every value here is either a direct sum of
// already-logged snapshot data or simple arithmetic over it.

export interface NutritionTotals {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface NutritionGoalValues {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface RemainingTotals {
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

/** Rounds to 2 decimal places, matching the numeric(_, 2) columns this feeds into. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Sums the already-computed totals stored on each food_logs row. Each row
 * already holds its final snapshot values (see calculateLogTotals), so this
 * is a plain sum -- never a re-multiplication against the live foods table.
 */
export function sumDailyTotals(logs: FoodLogRow[]): NutritionTotals {
  return logs.reduce<NutritionTotals>(
    (acc, log) => ({
      calories: round2(acc.calories + log.calories),
      proteinG: round2(acc.proteinG + log.proteinG),
      carbsG: round2(acc.carbsG + log.carbsG),
      fatG: round2(acc.fatG + log.fatG),
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** Remaining is only meaningful for a macro that actually has a target -- never invented when no goal is set. */
export function calculateRemaining(
  consumed: NutritionTotals,
  goals: NutritionGoalValues,
): RemainingTotals {
  return {
    calories: goals.calories !== null ? round2(goals.calories - consumed.calories) : null,
    proteinG: goals.proteinG !== null ? round2(goals.proteinG - consumed.proteinG) : null,
    carbsG: goals.carbsG !== null ? round2(goals.carbsG - consumed.carbsG) : null,
    fatG: goals.fatG !== null ? round2(goals.fatG - consumed.fatG) : null,
  };
}

/** A brand-new log's totals, from a food's per-serving values and the chosen quantity (in servings -- see calculateNutritionForQuantity for converting a raw amount like "100 g" into this). */
export function calculateLogTotals(
  food: { calories: number; proteinG: number; carbsG: number; fatG: number },
  quantity: number,
): NutritionTotals {
  return {
    calories: round2(food.calories * quantity),
    proteinG: round2(food.proteinG * quantity),
    carbsG: round2(food.carbsG * quantity),
    fatG: round2(food.fatG * quantity),
  };
}

/**
 * How the user is expressing how much they're logging:
 *  - 'unit': an absolute amount in the food's own servingUnit (e.g. "100"
 *    when servingUnit is "g") -- converted to a servings ratio via
 *    enteredQuantity / servingSize.
 *  - 'servings': the servings count itself (e.g. "2" meaning 2 servings) --
 *    used as the ratio directly, exactly food_logs.quantity's existing
 *    meaning.
 */
export type QuantityMode = 'unit' | 'servings';

/**
 * THE single place "how much am I actually logging" is converted into the
 * servings multiplier every other calculation in this file (and
 * food_logs.quantity itself) already works in -- used identically by
 * LogFoodStep (Food Library, Search Food, and Scan Barcode all share it)
 * and the edit-quantity flow, so there is exactly one implementation of
 * "100 g of an 85 g serving = 100/85 servings" in the whole app.
 *
 * Returns null (never a guessed/fabricated ratio) for a non-positive or
 * non-finite entered amount, and for 'unit' mode when servingSize itself
 * isn't a usable positive number -- there is no way to turn an absolute
 * amount into a servings ratio without a real serving size to divide by.
 */
export function quantityToServings(
  servingSize: number,
  enteredQuantity: number,
  mode: QuantityMode,
): number | null {
  if (!Number.isFinite(enteredQuantity) || enteredQuantity <= 0) return null;
  if (mode === 'servings') return enteredQuantity;
  if (!Number.isFinite(servingSize) || servingSize <= 0) return null;
  return enteredQuantity / servingSize;
}

/**
 * Calories = caloriesPerServing × (enteredQuantity / servingSize), and the
 * exact same ratio for protein/carbs/fat -- the one calculation this whole
 * feature is built around (see quantityToServings' own comment). Returns
 * null under the same conditions quantityToServings does, so a caller can
 * disable its own "Log"/"Save" action on an unusable input without having
 * to duplicate that validation itself.
 */
export function calculateNutritionForQuantity(
  perServing: { calories: number; proteinG: number; carbsG: number; fatG: number },
  servingSize: number,
  enteredQuantity: number,
  mode: QuantityMode,
): NutritionTotals | null {
  const servings = quantityToServings(servingSize, enteredQuantity, mode);
  if (servings === null) return null;
  return calculateLogTotals(perServing, servings);
}

export interface WeeklyCalorieSummary {
  consumed: number;
  target: number;
  remaining: number;
  /** 0-1, clamped -- consumed / target, purely for a visual progress bar. Never exceeds 1 even when actually over budget (remaining still reports the real, possibly-negative number). */
  percent: number;
}

/**
 * The week's target is always 7x the user's own saved DAILY calorie target
 * (nutrition_goals.calories) -- never a separately-configured weekly value,
 * so it's always in sync with whatever the user last saved on Nutrition
 * Goals. Returns null (never a fabricated target) when no daily target has
 * been set yet.
 */
export function computeWeeklyCalorieSummary(
  weeklyConsumedCalories: number,
  dailyCalorieTarget: number | null,
): WeeklyCalorieSummary | null {
  if (dailyCalorieTarget === null) return null;
  const target = dailyCalorieTarget * 7;
  const percent = target > 0 ? Math.min(1, Math.max(0, weeklyConsumedCalories / target)) : 0;
  return {
    consumed: round2(weeklyConsumedCalories),
    target,
    remaining: round2(target - weeklyConsumedCalories),
    percent,
  };
}

/**
 * Recomputes an existing food log's totals for a new quantity using ONLY
 * the log's own already-stored snapshot -- never the live foods table.
 * This is what keeps a quantity edit from silently pulling in today's
 * edited food data:
 *
 *   newTotal = existingTotal / existingQuantity * newQuantity
 */
export function recalculateForQuantity(
  log: { calories: number; proteinG: number; carbsG: number; fatG: number; quantity: number },
  newQuantity: number,
): NutritionTotals {
  const ratio = newQuantity / log.quantity;
  return {
    calories: round2(log.calories * ratio),
    proteinG: round2(log.proteinG * ratio),
    carbsG: round2(log.carbsG * ratio),
    fatG: round2(log.fatG * ratio),
  };
}
