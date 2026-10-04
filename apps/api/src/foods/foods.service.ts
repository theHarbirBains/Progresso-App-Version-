import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AnthropicNutritionProvider } from './providers/anthropic-nutrition.provider';
import { FOOD_PROVIDER, type FoodProvider, type NormalizedFood } from './food-provider.interface';
import type { Amount } from '../nutrition-resolution/quantity';
import { resolveComponent } from '../nutrition-resolution/resolver';
import type { NutritionSource } from '../nutrition-resolution/source.interface';
import { cookingWordsIn, withoutCookingWords } from '../nutrition-resolution/cooking';
import { CatalogNutritionSource } from './sources/catalog.source';
import { OpenFoodFactsNutritionSource } from './sources/open-food-facts.source';
import { UsdaNutritionSource } from './sources/usda.source';
import {
  buildInterpretation,
  requestsFromParsed,
  statusFromOutcome,
  type ComponentPick,
  type ComponentRequest,
  type ComponentStatus,
  type InterpretFoodResponse,
} from './interpretation';

/** Rounds to a fixed number of decimal places, for figures shown to the user. */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const FOOD_COLUMNS =
  'id, name, brand, image_url, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, provider, barcode';

// provider_food_id is never part of FoodRecord (toFoodRecord doesn't read
// it) -- selected only so upsertExternalFoods can re-match a batch
// upsert's returned rows back to the provider's own result order.
const FOOD_COLUMNS_WITH_PROVIDER_ID = `${FOOD_COLUMNS}, provider_food_id`;

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
    private readonly nutritionProvider: AnthropicNutritionProvider,
  ) {}

  /**
   * AI Food Search. Claude parses the description into its parts. The resolver then matches
   * each component against the best source for it, in the order sourcesFor() gives. Figures
   * come from data. Claude's memory is used only as a labelled last resort, for a component
   * no source matched and whose amount is known. Nothing is saved here: the client saves only
   * when the user taps Add to Food Library.
   */
  async interpretDescription(description: string): Promise<InterpretFoodResponse> {
    const parsed = await this.nutritionProvider.parse(description);
    // Only a description with no food to look up is sent back as a question. A missing amount is
    // handled by the resolver, which asks for it with the source's own options.
    if (parsed.main === null) {
      return {
        status: 'clarification',
        question: parsed.clarification ?? 'What did you eat?',
      };
    }

    const statuses: ComponentStatus[] = [];
    for (const request of requestsFromParsed(parsed)) {
      statuses.push(await this.resolveRequest(request, null));
    }
    return {
      status: 'ok',
      interpretation: buildInterpretation(parsed.main.name, parsed.preparation, statuses),
    };
  }

  /**
   * Resolves one component the user was still waiting on: after they picked a candidate
   * (pick is set), or after they gave an amount. Only that component is re-run.
   */
  async resolveComponent(
    request: ComponentRequest,
    pick: ComponentPick | null,
  ): Promise<ComponentStatus> {
    return this.resolveRequest(request, pick);
  }

  private async resolveRequest(
    request: ComponentRequest,
    pick: ComponentPick | null,
  ): Promise<ComponentStatus> {
    const outcome = await resolveComponent(
      {
        name: request.name,
        query: {
          term: request.term,
          brand: request.brand,
          barcode: request.barcode,
          restaurant: null,
        },
        quantity: request.quantity,
        pick,
      },
      this.sourcesFor(request),
    );
    const status = statusFromOutcome(request, outcome);
    if (status.state !== 'not_found' || pick !== null) return status;

    // No food data for this exact preparation. Retry with the food itself, and say so.
    const base = withoutCookingWords(request.term);
    const cooking = cookingWordsIn(request.term);
    if (cooking.length > 0 && base.length > 0) {
      const retry = await resolveComponent(
        {
          name: request.name,
          query: { term: base, brand: request.brand, barcode: request.barcode, restaurant: null },
          quantity: request.quantity,
          pick: null,
        },
        this.sourcesFor(request),
      );
      const retried = statusFromOutcome(request, retry);
      if (retried.state === 'resolved') {
        retried.component.provenance.assumptions.push(
          `No food data for "${cooking.join(' ')}" in this form; used the closest match, ${retried.component.provenance.matchedName}.`,
        );
        return retried;
      }
      if (retried.state !== 'not_found') return retried;
    }

    // No source matched. The amount is needed before any estimate can be stated for it.
    if (request.quantity === null) {
      return {
        state: 'needs_quantity',
        request,
        matchedName: null,
        options: [],
        reason: 'No food data matched this. How much did you have?',
      };
    }
    return this.estimateRequest(request, request.quantity);
  }

  /**
   * The order sources are tried in. A named brand or a barcode points at a product, so branded
   * sources come before generic data. Otherwise generic data comes first, and branded products
   * after it. The Progresso catalog is always first.
   */
  private sourcesFor(request: ComponentRequest): NutritionSource[] {
    const catalog = new CatalogNutritionSource(this.supabaseService);
    const usda = new UsdaNutritionSource(this.supabaseService);
    const offSearch = new OpenFoodFactsNutritionSource(this.provider, 'search');
    const offBarcode = new OpenFoodFactsNutritionSource(this.provider, 'barcode');
    if (request.barcode) return [catalog, offBarcode, offSearch];
    if (request.brand) return [catalog, offSearch, usda];
    return [catalog, usda, offSearch];
  }

  private async estimateRequest(
    request: ComponentRequest,
    quantity: Amount,
  ): Promise<ComponentStatus> {
    try {
      const estimate = await this.nutritionProvider.estimate(
        `${quantity.amount} ${quantity.unit} of ${request.name}`,
      );
      return {
        state: 'ai_estimate',
        request,
        component: {
          name: request.name,
          quantity,
          grams: null,
          nutrients: {
            calories: Math.round(estimate.calories),
            proteinG: roundTo(estimate.proteinG, 1),
            carbsG: roundTo(estimate.carbsG, 1),
            fatG: roundTo(estimate.fatG, 1),
          },
          provenance: {
            confidence: 'ai_estimate',
            sourceKind: 'ai_estimate',
            sourceId: null,
            matchedName: null,
            brand: null,
            dataVersion: null,
            retrievedAt: new Date().toISOString(),
            licence: 'none',
            attribution: null,
            assumptions: ['AI estimate: no food data matched this. Not verified.'],
          },
        },
      };
    } catch {
      return {
        state: 'not_found',
        request,
        reason: 'We could not estimate this. Try describing it differently.',
      };
    }
  }

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
   *
   * The local lookup is scoped to the caller: the shared catalog
   * (created_by is null) plus the caller's OWN custom foods. A custom food a
   * user entered by hand for an unknown barcode is private to them -- it must
   * never be returned to anyone else who scans the same code (user data
   * isolation) -- and preferring the caller's own means their entry wins on
   * the next scan.
   */
  async getByBarcode(barcode: string, userId: string): Promise<FoodRecord | null> {
    const trimmed = barcode.trim();
    if (!trimmed) return null;

    const cached = await this.queryLocalByBarcode(trimmed, userId);
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

  private async queryLocalByBarcode(barcode: string, userId: string): Promise<FoodRecord | null> {
    // The id comes from the verified auth token, but it is interpolated into a
    // PostgREST filter string, so it must be a plain UUID -- anything else can
    // only match the shared catalog.
    const ownFilter = UUID_PATTERN.test(userId) ? `,created_by.eq.${userId}` : '';
    const { data, error } = await this.supabaseService
      .getClient()
      .from('foods')
      .select(FOOD_COLUMNS)
      .eq('barcode', barcode)
      .eq('is_active', true)
      .or(`created_by.is.null${ownFilter}`)
      // Own custom food first (a non-null created_by), then the shared catalog.
      .order('created_by', { ascending: true, nullsFirst: false })
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

    return this.upsertExternalFoods(result.foods);
  }

  private toUpsertRow(food: NormalizedFood) {
    return {
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
    };
  }

  /**
   * Upserts a whole search page in one round trip -- on (provider,
   * provider_food_id), so re-searching the same product refreshes its
   * cached nutrition data instead of inserting a duplicate row. A single
   * batch upsert either applies entirely or not at all, so one malformed
   * row would otherwise silently drop an entire, mostly-good page of
   * results; falls back to one upsert per food (the old behavior, which
   * degrades a single bad row rather than the whole page) only if the
   * batch itself fails.
   */
  private async upsertExternalFoods(foods: NormalizedFood[]): Promise<FoodRecord[]> {
    if (foods.length === 0) return [];

    const { data, error } = await this.supabaseService
      .getClient()
      .from('foods')
      .upsert(
        foods.map((food) => this.toUpsertRow(food)),
        { onConflict: 'provider,provider_food_id' },
      )
      .select(FOOD_COLUMNS_WITH_PROVIDER_ID);

    if (!error && data) {
      // A multi-row upsert's returned rows aren't guaranteed to preserve
      // input order (no ORDER BY on an upsert) -- re-matched back onto the
      // provider's own relevance ranking (foods) rather than whatever
      // order Postgres happened to return.
      const byProviderFoodId = new Map(
        data.map((row) => [row.provider_food_id as string, toFoodRecord(row)]),
      );
      return foods
        .map((food) => byProviderFoodId.get(food.providerFoodId))
        .filter((record): record is FoodRecord => record !== undefined);
    }

    this.logger.warn(
      `Batch external food cache upsert failed, falling back per-item: ${error?.message}`,
    );
    const cached = await Promise.all(foods.map((food) => this.upsertExternalFood(food)));
    return cached.filter((food): food is FoodRecord => food !== null);
  }

  private async upsertExternalFood(food: NormalizedFood): Promise<FoodRecord | null> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('foods')
      .upsert(this.toUpsertRow(food), { onConflict: 'provider,provider_food_id' })
      .select(FOOD_COLUMNS)
      .maybeSingle();

    if (error) {
      this.logger.warn(`Failed to cache external food ${food.providerFoodId}: ${error.message}`);
      return null;
    }
    return data ? toFoodRecord(data) : null;
  }
}

/** Escapes ILIKE's own wildcard characters so a literal "%"/"_" a user typed is matched literally, same convention as the mobile app's own lib/ilike.ts. */
function escapeIlike(value: string): string {
  return value.replace(/[%_\\]/g, (match) => `\\${match}`);
}
