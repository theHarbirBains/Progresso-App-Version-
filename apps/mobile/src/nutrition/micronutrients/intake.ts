import type { NutrientAmounts, NutrientId } from './nutrients';

// How much of each micronutrient a day's foods add up to, and how much of the day that's from.
// Pure.
//
// Each log adds what its own snapshot holds (food_logs.micronutrients, made when it was logged),
// once. A food whose data doesn't give a nutrient adds nothing to it and is counted as missing it:
// the total is then what the foods with data add up to, never padded with zeros or estimates, and
// every screen says how many foods it's from. A day with nothing logged isn't a day of nothing
// eaten -- it's left out of the week's average.

export interface NutrientIntake {
  /** What the foods with data for it add up to; 0 with none. */
  amount: number;
  /** How many of the day's foods have a figure for it. */
  foodsWithData: number;
  /** How many foods were logged that day. */
  foodsLogged: number;
}

/** Whether a total covers every food logged. */
export const isComplete = (intake: NutrientIntake) =>
  intake.foodsLogged > 0 && intake.foodsWithData === intake.foodsLogged;

/** Whether any food logged has a figure for it. */
export const hasData = (intake: NutrientIntake) => intake.foodsWithData > 0;

/** A day's intake of one nutrient from its logs. */
export function nutrientIntake(
  logs: readonly { micronutrients?: NutrientAmounts | null }[],
  id: NutrientId,
): NutrientIntake {
  let amount = 0;
  let foodsWithData = 0;
  for (const log of logs) {
    const value = log.micronutrients?.[id];
    if (value === undefined) continue;
    amount += value;
    foodsWithData += 1;
  }
  return { amount: Math.round(amount * 10000) / 10000, foodsWithData, foodsLogged: logs.length };
}

export interface WeekIntake {
  /** The average over the days with any figure for it; null with none. */
  average: number | null;
  /** Days with anything logged. */
  daysLogged: number;
  /** Logged days with a figure for it from at least one food (the average is over these). */
  daysWithData: number;
  /** Of those, the days where every food logged had one. */
  daysComplete: number;
  /** Days in the stretch looked at (the week so far). */
  days: number;
}

/**
 * A stretch of days' average intake of one nutrient: over the days that have data for it, never
 * the days with nothing logged (or with no data for it), which would read as eating none.
 */
export function weekIntake(
  days: readonly (readonly { micronutrients?: NutrientAmounts | null }[])[],
  id: NutrientId,
): WeekIntake {
  let sum = 0;
  let daysLogged = 0;
  let daysWithData = 0;
  let daysComplete = 0;
  for (const logs of days) {
    if (logs.length === 0) continue;
    daysLogged += 1;
    const day = nutrientIntake(logs, id);
    if (!hasData(day)) continue;
    daysWithData += 1;
    if (isComplete(day)) daysComplete += 1;
    sum += day.amount;
  }
  return {
    average: daysWithData > 0 ? Math.round((sum / daysWithData) * 10000) / 10000 : null,
    daysLogged,
    daysWithData,
    daysComplete,
    days: days.length,
  };
}

/** An amount against a reference value: the percentage of it, and how full a bar is (never past full). */
export function progressOf(
  amount: number,
  reference: number | null,
): { percent: number | null; fraction: number } {
  if (reference === null || reference <= 0) return { percent: null, fraction: 0 };
  const percent = (amount / reference) * 100;
  return { percent: Math.round(percent), fraction: Math.min(1, percent / 100) };
}
