import type { SupabaseService } from '../../supabase/supabase.service';
import { tokenize } from '../../nutrition-resolution/scoring';
import type {
  FoodQuery,
  MeasureWeight,
  NutritionSource,
  SourceCandidate,
} from '../../nutrition-resolution/source.interface';
import { escapeLike } from './catalog.source';

const CANDIDATE_LIMIT = 25;

/** USDA's citation, as its FoodData Central documentation suggests it. */
export const USDA_CITATION =
  'U.S. Department of Agriculture, Agricultural Research Service, Beltsville Human Nutrition Research Center. FoodData Central.';

/**
 * USDA FoodData Central reference data, read from usda_food_reference and usda_food_measure.
 * Which USDA data types it searches is configuration, so Branded Foods can be added later by
 * adding 'Branded' to the list, without changing the resolver.
 */
export class UsdaNutritionSource implements NutritionSource {
  readonly kind = 'usda_fdc' as const;
  readonly licence = 'public_domain' as const;
  readonly storable = true;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly dataTypes: readonly string[] = ['Foundation', 'SR Legacy'],
  ) {}

  async search(query: FoodQuery): Promise<SourceCandidate[]> {
    const words = tokenize(query.term).slice(0, 3);
    if (words.length === 0) return [];
    const client = this.supabaseService.getClient();

    let request = client
      .from('usda_food_reference')
      .select(
        'fdc_id, description, data_type, brand_owner, gtin_upc, calories_per_100g, protein_g_per_100g, carbs_g_per_100g, fat_g_per_100g, data_version',
      )
      .in('data_type', [...this.dataTypes])
      .limit(CANDIDATE_LIMIT);
    for (const word of words) {
      request = request.ilike('description', `%${escapeLike(word)}%`);
    }
    const { data: foods, error } = await request;
    if (error) throw new Error(`USDA search failed: ${error.message}`);
    if (!foods || foods.length === 0) return [];

    const ids = foods.map((food) => Number(food.fdc_id));
    const { data: measureRows, error: measureError } = await client
      .from('usda_food_measure')
      .select('fdc_id, unit, amount, grams')
      .in('fdc_id', ids);
    if (measureError) throw new Error(`USDA measure lookup failed: ${measureError.message}`);

    const measuresById = new Map<number, MeasureWeight[]>();
    for (const row of measureRows ?? []) {
      const list = measuresById.get(Number(row.fdc_id)) ?? [];
      list.push({ unit: String(row.unit), amount: Number(row.amount), grams: Number(row.grams) });
      measuresById.set(Number(row.fdc_id), list);
    }

    const retrievedAt = new Date().toISOString();
    return foods.map((food) => ({
      sourceKind: 'usda_fdc' as const,
      sourceId: String(food.fdc_id),
      matchedName: String(food.description),
      brand: (food.brand_owner as string | null) ?? null,
      barcode: (food.gtin_upc as string | null) ?? null,
      basis: {
        kind: 'per_100g' as const,
        nutrients: {
          calories: Number(food.calories_per_100g),
          proteinG: Number(food.protein_g_per_100g),
          carbsG: Number(food.carbs_g_per_100g),
          fatG: Number(food.fat_g_per_100g),
        },
      },
      measures: measuresById.get(Number(food.fdc_id)) ?? [],
      dataVersion: String(food.data_version),
      retrievedAt,
    }));
  }

  /** The citation USDA asks for, with the date the figures were retrieved. */
  attribution(candidate: SourceCandidate): string {
    const accessed = candidate.retrievedAt.slice(0, 10);
    return `${USDA_CITATION} ${candidate.dataVersion}. Accessed ${accessed}. https://fdc.nal.usda.gov/`;
  }
}
