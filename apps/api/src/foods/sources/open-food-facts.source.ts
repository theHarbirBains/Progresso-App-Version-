import type { FoodProvider, NormalizedFood } from '../food-provider.interface';
import type {
  FoodQuery,
  NutritionSource,
  SourceCandidate,
} from '../../nutrition-resolution/source.interface';

const CANDIDATE_LIMIT = 10;

/**
 * Open Food Facts, through the existing FoodProvider seam. Two modes: a barcode lookup (the
 * product with exactly that barcode) and a text search for branded products. Figures are per
 * serving, as the product states them. Products missing any of the four figures are dropped.
 */
export class OpenFoodFactsNutritionSource implements NutritionSource {
  readonly kind = 'open_food_facts' as const;
  readonly licence = 'odbl' as const;
  readonly storable = true;

  constructor(
    private readonly provider: FoodProvider,
    private readonly mode: 'barcode' | 'search',
  ) {}

  async search(query: FoodQuery): Promise<SourceCandidate[]> {
    if (this.mode === 'barcode') {
      if (!query.barcode) return [];
      const food = await this.provider.getFoodByBarcode(query.barcode);
      return food ? [toCandidate(food)].filter(isCandidate) : [];
    }
    const text = [query.brand, query.term].filter((part): part is string => !!part).join(' ');
    if (!text.trim()) return [];
    const result = await this.provider.searchFoods(text, 0, CANDIDATE_LIMIT);
    return result.foods.map(toCandidate).filter(isCandidate);
  }

  attribution(): string {
    return 'Open Food Facts contributors (ODbL)';
  }
}

function toCandidate(food: NormalizedFood): SourceCandidate | null {
  if (
    food.calories === null ||
    food.proteinG === null ||
    food.carbsG === null ||
    food.fatG === null
  ) {
    return null;
  }
  return {
    sourceKind: 'open_food_facts',
    sourceId: food.providerFoodId,
    matchedName: food.name,
    brand: food.brand,
    barcode: food.barcode,
    basis: {
      kind: 'per_serving',
      size: food.servingSize,
      unit: food.servingUnit,
      nutrients: {
        calories: food.calories,
        proteinG: food.proteinG,
        carbsG: food.carbsG,
        fatG: food.fatG,
      },
    },
    measures: [],
    dataVersion: 'open-food-facts-live',
    retrievedAt: new Date().toISOString(),
  };
}

function isCandidate(value: SourceCandidate | null): value is SourceCandidate {
  return value !== null;
}
