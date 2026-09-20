import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FOOD_PROVIDER, type FoodProvider, type NormalizedFood } from './food-provider.interface';

export interface FoodRecord {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  provider: string | null;
  barcode: string | null;
}

export interface FoodSearchResponse {
  foods: FoodRecord[];
  hasMore: boolean;
}

const FOOD_COLUMNS =
  'id, name, brand, image_url, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, provider, barcode';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFoodRecord(row: any): FoodRecord {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand ?? null,
    imageUrl: row.image_url ?? null,
    servingSize: Number(row.serving_size),
    servingUnit: row.serving_unit,
    calories: Number(row.calories),
    proteinG: row.protein_g === null ? null : Number(row.protein_g),
    carbsG: row.carbs_g === null ? null : Number(row.carbs_g),
    fatG: row.fat_g === null ? null : Number(row.fat_g),
    provider: row.provider ?? null,
    barcode: row.barcode ?? null,
  };
}

/**
 * Searches Progresso's own cached default-food catalog (the generic seeded
 * foods from Phase 6, plus anything a previous search has already cached
 * from an external provider -- both live in the same public.foods,
 * created_by is null, rows) AND, on the first page only, the live external
 * FoodProvider for fresh branded results, which get upserted into
 * public.foods (never duplicated -- see FOOD_PROVIDER_UNIQUE below) before
 * being merged into the response. This is the one place that knows both
 * "our database" and "the external provider" exist; the mobile app and its
 * FoodRow type never see the difference.
 */
@Injectable()
export class FoodsService {
  private readonly logger = new Logger(FoodsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(FOOD_PROVIDER) private readonly provider: FoodProvider,
  ) {}

  async search(query: string, page: number, pageSize: number): Promise<FoodSearchResponse> {
    const trimmed = query.trim();
    if (!trimmed) return { foods: [], hasMore: false };

    const local = await this.searchLocal(trimmed, page, pageSize);

    // External results only fetched on the first page -- once cached, they
    // become part of the local catalog for any later page, and this keeps
    // v1 from needing to track the external provider's own page cursor
    // across requests.
    let externalRecords: FoodRecord[] = [];
    if (page === 0) {
      externalRecords = await this.fetchAndCacheExternal(trimmed, pageSize);
    }

    const seen = new Set<string>();
    const merged: FoodRecord[] = [];
    for (const food of [...local, ...externalRecords]) {
      if (seen.has(food.id)) continue;
      seen.add(food.id);
      merged.push(food);
      if (merged.length >= pageSize) break;
    }

    return { foods: merged, hasMore: merged.length >= pageSize };
  }

  // Two plain, separately-parameterized ilike() calls rather than a single
  // .or('name.ilike....,brand.ilike....') -- PostgREST's .or() takes a raw
  // filter-expression string, so a search term containing a comma or
  // parenthesis would need its own escaping for that mini-language on top
  // of ILIKE's; two ordinary calls sidestep that entirely (same reasoning
  // as the mobile app's searchDefaultFoods).
  private async searchLocal(query: string, page: number, pageSize: number): Promise<FoodRecord[]> {
    const pattern = `%${escapeIlike(query)}%`;
    const limit = (page + 1) * pageSize;

    const [byName, byBrand] = await Promise.all([
      this.queryLocalFoods('name', pattern, limit),
      this.queryLocalFoods('brand', pattern, limit),
    ]);

    const seen = new Set<string>();
    const merged: FoodRecord[] = [];
    for (const food of [...byName, ...byBrand].sort((a, b) => a.name.localeCompare(b.name))) {
      if (seen.has(food.id)) continue;
      seen.add(food.id);
      merged.push(food);
    }

    const from = page * pageSize;
    return merged.slice(from, from + pageSize);
  }

  private async queryLocalFoods(
    column: 'name' | 'brand',
    pattern: string,
    limit: number,
  ): Promise<FoodRecord[]> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('foods')
      .select(FOOD_COLUMNS)
      .is('created_by', null)
      .eq('is_active', true)
      .ilike(column, pattern)
      .order('name', { ascending: true })
      .limit(limit);

    if (error) {
      throw new InternalServerErrorException('Failed to search foods');
    }
    return (data ?? []).map(toFoodRecord);
  }

  /**
   * Barcode lookup for the Scan Barcode flow: checks Progresso's own cached
   * catalog first (a previously-scanned/searched product, or a seeded
   * default food that happens to carry a barcode), and only calls the
   * external provider on a cache miss -- the same "cache by barcode" the
   * unique (provider, provider_food_id) index and the barcode index exist
   * for. A provider hit is cached via the same upsertExternalFood path
   * search() already uses, so re-scanning the same product never hits the
   * provider twice. Returns null (never throws) both when the product
   * genuinely doesn't exist and when the provider degrades -- barcode
   * lookup failing is an expected, normal outcome (Open Food Facts doesn't
   * have every product), not an exceptional one; the controller/mobile
   * side render this as a friendly "Product not found" state either way.
   */
  async getByBarcode(barcode: string): Promise<FoodRecord | null> {
    const trimmed = barcode.trim();
    if (!trimmed) return null;

    const cached = await this.queryLocalByBarcode(trimmed);
    if (cached) return cached;

    let food: NormalizedFood | null;
    try {
      food = await this.provider.getFoodByBarcode(trimmed);
    } catch (err) {
      this.logger.warn(
        `Food provider barcode lookup failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
    if (!food) return null;

    return this.upsertExternalFood(food);
  }

  private async queryLocalByBarcode(barcode: string): Promise<FoodRecord | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('foods')
      .select(FOOD_COLUMNS)
      .eq('barcode', barcode)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException('Failed to look up food by barcode');
    }
    return data ? toFoodRecord(data) : null;
  }

  private async fetchAndCacheExternal(query: string, pageSize: number): Promise<FoodRecord[]> {
    let result: { foods: NormalizedFood[] };
    try {
      result = await this.provider.searchFoods(query, 0, pageSize);
    } catch (err) {
      // A provider outage degrades to local-only results, never fails the
      // whole search -- see NutritionTodayScreen-style "show what we have"
      // precedent elsewhere in this app.
      this.logger.warn(
        `Food provider search failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }

    const cached = await Promise.all(result.foods.map((food) => this.upsertExternalFood(food)));
    return cached.filter((food): food is FoodRecord => food !== null);
  }

  /** Upserts on (provider, provider_food_id) -- re-searching the same product refreshes its cached nutrition data instead of inserting a duplicate row. */
  private async upsertExternalFood(food: NormalizedFood): Promise<FoodRecord | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('foods')
      .upsert(
        {
          name: food.name,
          brand: food.brand,
          image_url: food.imageUrl,
          serving_size: food.servingSize,
          serving_unit: food.servingUnit,
          calories: food.calories,
          protein_g: food.proteinG,
          carbs_g: food.carbsG,
          fat_g: food.fatG,
          provider: food.provider,
          provider_food_id: food.providerFoodId,
          barcode: food.barcode,
          created_by: null,
          is_active: true,
        },
        { onConflict: 'provider,provider_food_id' },
      )
      .select(FOOD_COLUMNS)
      .maybeSingle();

    if (error) {
      this.logger.warn(`Failed to cache external food ${food.providerFoodId}: ${error.message}`);
      return null;
    }
    return data ? toFoodRecord(data) : null;
  }
}

/** Escapes ILIKE's own wildcard characters so a literal "%"/"_" a user typed is matched literally, same convention as the mobile searchDefaultFoods. */
function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}
