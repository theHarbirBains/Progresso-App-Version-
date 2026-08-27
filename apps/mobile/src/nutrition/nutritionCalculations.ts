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

/** A brand-new log's totals, from a food's per-serving values and the chosen quantity. */
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
