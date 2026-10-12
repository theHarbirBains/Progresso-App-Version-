// The amount typed on the log step, and the servings it comes to -- what a log stores. A food
// whose serving is a weight (g, kg, oz) can also be logged by weight: 250 g of a food whose
// serving is 100 g is 2.5 servings. Every other serving unit is logged in servings only.

/** What the log step's amount is typed in. */
export type QuantityUnit = 'servings' | 'g' | 'oz';

const GRAMS_PER_OUNCE = 28.349523125;

// The serving units that are weights, in grams per unit.
const GRAMS_PER_SERVING_UNIT: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: GRAMS_PER_OUNCE,
};

/** What one serving weighs in grams, or null when the serving is not a weight (a cup, a slice). */
export function gramsPerServing(food: { servingSize: number; servingUnit: string }): number | null {
  const perUnit = GRAMS_PER_SERVING_UNIT[food.servingUnit.trim().toLowerCase()];
  return perUnit === undefined ? null : food.servingSize * perUnit;
}

/** Rounds to the 2 decimal places food_logs.quantity stores. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The servings an amount typed in `unit` comes to, rounded the way a log stores them. */
export function toServings(
  amount: number,
  unit: QuantityUnit,
  servingGrams: number | null,
): number {
  if (unit === 'servings' || servingGrams === null) return round2(amount);
  const grams = unit === 'g' ? amount : amount * GRAMS_PER_OUNCE;
  return round2(grams / servingGrams);
}

/** A number of servings as the amount to show in `unit`, so switching units keeps the amount. */
export function fromServings(
  servings: number,
  unit: QuantityUnit,
  servingGrams: number | null,
): string {
  if (unit === 'servings' || servingGrams === null) return String(round2(servings));
  const grams = servings * servingGrams;
  return String(round2(unit === 'g' ? grams : grams / GRAMS_PER_OUNCE));
}
