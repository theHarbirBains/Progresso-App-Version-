import type { FoodLogRow } from './foodLogQueries';
import { wholeFigureText } from './wholeFigures';

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

/** A brand-new log's totals, from a food's per-serving values and the chosen quantity, in servings (LogFoodStep's one quantity field -- Food Library, Search Food, and Scan Barcode all share it). */
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
 * The days left in the Sunday-to-Saturday week, today included: 7 on a Sunday, 1 on a Saturday --
 * what's left of a weekly calorie budget can be spread over.
 */
export function daysLeftInWeek(now: Date = new Date()): number {
  return 7 - now.getDay(); // getDay() is 0 on a Sunday .. 6 on a Saturday
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

/** What the daily calorie target is for: losing, keeping or gaining weight. */
export type CalorieGoal = 'cut' | 'maintain' | 'bulk';

/**
 * How far from the maintenance estimate a target has to be to be a cut or a bulk: half the
 * calculator's step (Nutrition Goals' maintenance, then 300 either way).
 */
export const GOAL_MARGIN_KCAL = 150;

export interface CalorieGoalReading {
  goal: CalorieGoal;
  /** The daily target less maintenance: negative for a cut. */
  offset: number;
}

/**
 * The goal a daily calorie target is set for, from the target against the maintenance estimate
 * (computeMaintenanceCalories, the calculator's own): 150 or more below is a cut, 150 or more
 * above a bulk, anything nearer maintaining. Null without both -- never guessed.
 */
export function calorieGoalFor(
  target: number | null,
  maintenance: number | null,
): CalorieGoalReading | null {
  if (target === null || maintenance === null) return null;
  const offset = target - maintenance;
  const goal: CalorieGoal =
    offset <= -GOAL_MARGIN_KCAL ? 'cut' : offset >= GOAL_MARGIN_KCAL ? 'bulk' : 'maintain';
  return { goal, offset };
}

/** "Cutting · 300 below maintenance", "Bulking · 300 above maintenance", "Maintaining". */
export function calorieGoalLabel(reading: CalorieGoalReading): string {
  switch (reading.goal) {
    case 'cut':
      return `Cutting · ${wholeFigureText(-reading.offset)} below maintenance`;
    case 'bulk':
      return `Bulking · ${wholeFigureText(reading.offset)} above maintenance`;
    default:
      return 'Maintaining';
  }
}

/**
 * What the week so far means for the goal, against the daily target for each of its days so far
 * (the day shown included): under it is on track for a cut, at or over it on track for a bulk,
 * within 5% of it on track to maintain. Said plainly either way.
 */
export function weekGoalNote(
  goal: CalorieGoal,
  consumed: number,
  dailyTarget: number,
  daysSoFar: number,
): string {
  const target = dailyTarget * daysSoFar;
  const over = consumed - target;
  switch (goal) {
    case 'cut':
      return over <= 0
        ? 'Under your target so far: on track for your cut.'
        : `${wholeFigureText(over)} cal over your target so far for your cut.`;
    case 'bulk':
      return over >= 0
        ? 'At or over your target so far: on track for your bulk.'
        : `${wholeFigureText(-over)} cal under your target so far: eat a little more for your bulk.`;
    default:
      return Math.abs(over) <= target * 0.05
        ? 'Close to your target so far: on track to maintain.'
        : `${wholeFigureText(Math.abs(over))} cal ${over > 0 ? 'over' : 'under'} your target so far.`;
  }
}
