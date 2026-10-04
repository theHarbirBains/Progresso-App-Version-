// Pure mapping from USDA FoodData Central responses to SourceCandidate. No network code:
// the adapter that calls the API and the bulk importer feed these functions.
// Shapes verified against live responses on 2026-10-04. Values are per 100 g.

import type { MeasureWeight, Nutrients, SourceCandidate } from './source.interface';

/** FoodData Central nutrient IDs for the four figures Progresso stores. */
export const USDA_NUTRIENT_IDS = {
  calories: 1008, // Energy, KCAL
  proteinG: 1003, // Protein, G
  fatG: 1004, // Total lipid (fat), G
  carbsG: 1005, // Carbohydrate, by difference, G
} as const;

export interface UsdaSearchFood {
  fdcId: number;
  description: string;
  dataType: string;
  brandOwner?: string;
  brandName?: string;
  gtinUpc?: string;
  publishedDate?: string;
  foodNutrients: { nutrientId: number; value: number }[];
}

export interface UsdaPortion {
  amount: number;
  gramWeight: number;
  /** Often "undetermined" for SR Legacy records -- not the household name. */
  measureUnit?: { name?: string; abbreviation?: string } | null;
  /** The household name in SR Legacy records, e.g. "cup", or a size like "potato (2-1/3\" x 4-3/4\")". */
  modifier?: string | null;
  portionDescription?: string | null;
}

/** Null when the record lacks any of the four figures, rather than a fabricated zero. */
export function nutrientsFromUsda(
  foodNutrients: { nutrientId: number; value: number }[],
): Nutrients | null {
  const byId = new Map(foodNutrients.map((n) => [n.nutrientId, n.value]));
  const calories = byId.get(USDA_NUTRIENT_IDS.calories);
  const proteinG = byId.get(USDA_NUTRIENT_IDS.proteinG);
  const fatG = byId.get(USDA_NUTRIENT_IDS.fatG);
  const carbsG = byId.get(USDA_NUTRIENT_IDS.carbsG);
  if (
    calories === undefined ||
    proteinG === undefined ||
    fatG === undefined ||
    carbsG === undefined
  ) {
    return null;
  }
  return { calories, proteinG, carbsG, fatG };
}

/**
 * USDA portion records. Verified against a live SR Legacy response: the
 * household name is in `modifier` ("cup"), while `measureUnit.name` is
 * "undetermined". So the unit is taken from the first of: a real measure name,
 * the portion description, then the modifier. Portions without a gram weight are
 * dropped rather than guessed.
 */
export function measuresFromUsda(portions: UsdaPortion[]): MeasureWeight[] {
  const measures: MeasureWeight[] = [];
  for (const portion of portions) {
    if (!(portion.gramWeight > 0) || !(portion.amount > 0)) continue;
    const measureName = portion.measureUnit?.name;
    // Foundation records carry a real measure name ("egg", "cup"). SR Legacy records carry
    // "undetermined" there, and the household name in the modifier.
    const candidates = [
      measureName && measureName !== 'undetermined' ? measureName : null,
      portion.modifier,
      portion.portionDescription,
    ];
    const unit = candidates.map((c) => (c ?? '').trim()).find((c) => c.length > 0);
    if (!unit) continue;
    measures.push({ unit, amount: portion.amount, grams: portion.gramWeight });
  }
  return measures;
}

export function candidateFromUsda(
  food: UsdaSearchFood,
  portions: UsdaPortion[],
  dataVersion: string,
  retrievedAt: string,
): SourceCandidate | null {
  const nutrients = nutrientsFromUsda(food.foodNutrients);
  if (!nutrients) return null;
  return {
    sourceKind: 'usda_fdc',
    sourceId: String(food.fdcId),
    matchedName: food.description,
    brand: food.brandOwner ?? food.brandName ?? null,
    barcode: food.gtinUpc ?? null,
    basis: { kind: 'per_100g', nutrients },
    measures: measuresFromUsda(portions),
    dataVersion,
    retrievedAt,
  };
}
