import type { EnteredAmount } from './foodLogQueries';
import type { FoodProvenance, FoodRow } from './foodQueries';
import { amountText, servingMeasures } from './logQuantity';
import { calculateLogTotals, type NutritionTotals } from './nutritionCalculations';

// Saved meals and recipes are both a list of foods, each with an amount. A saved meal is
// logged as each of its foods; a recipe is one food whose figures per serving are its
// ingredients' added up and divided by the servings it makes. Pure -- no I/O.

/** One food in a saved meal or a recipe, with its amount. */
export interface FoodGroupItem {
  food: FoodRow;
  /** Servings of the food -- what the figures are worked out from. */
  quantity: number;
  /** The amount as typed ("150" g), when it was kept. */
  entered: EnteredAmount | null;
}

/** Rounds to 2 decimal places, matching the numeric(_, 2) columns this feeds into. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** An item's amount as typed, or in servings: "150 g", "2 cookies", "1.5 servings". */
export function itemAmountText(item: FoodGroupItem): string {
  const { pieces } = servingMeasures(item.food);
  return item.entered
    ? amountText(item.entered.amount, item.entered.unit, pieces)
    : amountText(item.quantity, 'servings', pieces);
}

/** All the items' figures added up, at each food's figures now. */
export function groupTotals(items: FoodGroupItem[]): NutritionTotals {
  return items.reduce<NutritionTotals>(
    (sum, item) => {
      const totals = calculateLogTotals(item.food, item.quantity);
      return {
        calories: round2(sum.calories + totals.calories),
        proteinG: round2(sum.proteinG + totals.proteinG),
        carbsG: round2(sum.carbsG + totals.carbsG),
        fatG: round2(sum.fatG + totals.fatG),
      };
    },
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/** A recipe's figures for one serving: the whole batch's, divided by the servings it makes. */
export function recipePerServing(items: FoodGroupItem[], servings: number): NutritionTotals {
  const batch = groupTotals(items);
  return {
    calories: round2(batch.calories / servings),
    proteinG: round2(batch.proteinG / servings),
    carbsG: round2(batch.carbsG / servings),
    fatG: round2(batch.fatG / servings),
  };
}

/**
 * Where a recipe's figures came from: worked out from its ingredients, each of which is kept
 * as a component with its own amount, figures and confidence. If any ingredient's figures are
 * an AI estimate, so is the recipe's -- it can't be surer than its least sure part.
 */
export function recipeProvenance(items: FoodGroupItem[]): FoodProvenance {
  const estimated = items.some((item) => item.food.provenance?.confidence === 'ai_estimate');
  return {
    confidence: estimated ? 'ai_estimate' : 'calculated',
    sourceKind: 'user_entered',
    sourceId: null,
    matchedName: null,
    dataVersion: null,
    retrievedAt: null,
    licence: 'none',
    attribution: null,
    assumptions: estimated ? ['Some ingredients are AI estimates, not verified.'] : [],
    components: items.map((item) => {
      const totals = calculateLogTotals(item.food, item.quantity);
      return {
        name: item.food.name,
        amount: itemAmountText(item),
        calories: totals.calories,
        proteinG: totals.proteinG,
        carbsG: totals.carbsG,
        fatG: totals.fatG,
        confidence: item.food.provenance?.confidence ?? null,
      };
    }),
  };
}
