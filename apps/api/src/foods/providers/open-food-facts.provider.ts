import { Injectable, Logger } from '@nestjs/common';
import type { FoodProvider, FoodSearchResult, NormalizedFood } from '../food-provider.interface';

// Canada-scoped subdomain (rather than world.openfoodfacts.org) so search
// ranking favours products actually tagged/sold in Canada -- Progresso's
// primary market -- while still falling back to the full global database
// for anything not specifically tagged, per Open Food Facts' own documented
// country-subdomain convention. No API key: OFF's read/search API is open,
// but they ask every integration to identify itself with a descriptive
// User-Agent (see USER_AGENT below) rather than the default HTTP client one.
const BASE_URL = 'https://ca.openfoodfacts.org';
const USER_AGENT = 'Progresso/1.0 (fitness and nutrition app; contact via app support)';
const SEARCH_FIELDS =
  'code,product_name,brands,serving_size,serving_quantity,nutriments,image_front_url';
const REQUEST_TIMEOUT_MS = 8000;
const RETRY_DELAY_MS = 400;

interface OffNutriments {
  [key: string]: unknown;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_quantity?: string | number;
  nutriments?: OffNutriments;
  image_front_url?: string;
}

interface OffSearchResponse {
  products?: OffProduct[];
  count?: number;
  page?: number;
  page_size?: number;
}

interface OffProductResponse {
  status?: number;
  product?: OffProduct;
}

function toFiniteNumber(value: unknown): number | null {
  const num = typeof value === 'string' ? Number(value) : value;
  return typeof num === 'number' && Number.isFinite(num) ? num : null;
}

/**
 * One nutrient, resolved against whichever basis this product actually has
 * structured data for -- never a guess. When the product has a real
 * (grams) serving_quantity, the "_serving" field (already scoped to that
 * serving by OFF) is used first; if that specific nutrient is missing but
 * the per-100g figure exists, it's scaled by the real serving_quantity --
 * a unit conversion of the provider's own data, not an invented value. With
 * no structured serving_quantity at all, servingSizeG is 100 (see below),
 * so the same scaling collapses to "use the per-100g figure as-is".
 */
function pickNutrient(
  nutriments: OffNutriments | undefined,
  key: string,
  hasStructuredServing: boolean,
  servingSizeG: number,
): number | null {
  if (!nutriments) return null;
  if (hasStructuredServing) {
    const perServing = toFiniteNumber(nutriments[`${key}_serving`]);
    if (perServing !== null) return perServing;
  }
  const per100g = toFiniteNumber(nutriments[`${key}_100g`]);
  if (per100g === null) return null;
  return Math.round(per100g * (servingSizeG / 100) * 100) / 100;
}

/**
 * Normalizes one Open Food Facts product into Progresso's shape, or returns
 * null if it's missing something a search result can't do without (a name,
 * a barcode/id, or any calorie figure at all) -- dropped from results
 * rather than shown as a mostly-empty product (see FoodsService, which
 * filters nulls out of the batch this returns from).
 */
function normalizeProduct(product: OffProduct): NormalizedFood | null {
  const barcode = product.code?.trim();
  const name = product.product_name?.trim();
  if (!barcode || !name) return null;

  const structuredServing = toFiniteNumber(product.serving_quantity);
  const hasStructuredServing = structuredServing !== null && structuredServing > 0;
  const servingSize = hasStructuredServing ? (structuredServing as number) : 100;
  const servingUnit = 'g';

  const calories = pickNutrient(
    product.nutriments,
    'energy-kcal',
    hasStructuredServing,
    servingSize,
  );
  if (calories === null) return null;

  const brand = product.brands?.split(',')[0]?.trim() || null;
  const imageUrl = product.image_front_url?.trim() || null;

  return {
    provider: 'open_food_facts',
    providerFoodId: barcode,
    barcode,
    name,
    brand,
    imageUrl,
    servingSize,
    servingUnit,
    calories,
    proteinG: pickNutrient(product.nutriments, 'proteins', hasStructuredServing, servingSize),
    carbsG: pickNutrient(product.nutriments, 'carbohydrates', hasStructuredServing, servingSize),
    fatG: pickNutrient(product.nutriments, 'fat', hasStructuredServing, servingSize),
  };
}

@Injectable()
export class OpenFoodFactsProvider implements FoodProvider {
  readonly name = 'open_food_facts';
  private readonly logger = new Logger(OpenFoodFactsProvider.name);

  async searchFoods(query: string, page: number, pageSize: number): Promise<FoodSearchResult> {
    // The newer /api/v2/search endpoint was found unreliable (returning a
    // maintenance page) when this integration was verified against the
    // real API -- /cgi/search.pl is Open Food Facts' longer-established,
    // still fully supported search endpoint, confirmed working with this
    // exact query shape.
    const url = new URL('/cgi/search.pl', BASE_URL);
    url.searchParams.set('search_terms', query);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    // OFF's own paging is 1-indexed; every Progresso caller (mobile and
    // FoodsService) uses the existing 0-indexed convention already
    // established by fetchFoods/searchDefaultFoods.
    url.searchParams.set('page', String(page + 1));
    url.searchParams.set('page_size', String(pageSize));
    url.searchParams.set('fields', SEARCH_FIELDS);

    const response = await this.request(url);
    if (!response) return { foods: [], hasMore: false };

    const body = (await response.json()) as OffSearchResponse;
    const products = body.products ?? [];
    const foods = products
      .map((product) => normalizeProduct(product))
      .filter((food): food is NormalizedFood => food !== null);

    const count = body.count ?? 0;
    const hasMore = (page + 1) * pageSize < count;
    return { foods, hasMore };
  }

  async getFood(providerFoodId: string): Promise<NormalizedFood | null> {
    return this.getFoodByBarcode(providerFoodId);
  }

  // OFF has no separate non-barcode product id -- the barcode/GTIN itself
  // is the canonical product id in their system, so getFood and
  // getFoodByBarcode are the same lookup for this provider.
  async getFoodByBarcode(barcode: string): Promise<NormalizedFood | null> {
    const url = new URL(`/api/v2/product/${encodeURIComponent(barcode)}.json`, BASE_URL);
    url.searchParams.set('fields', SEARCH_FIELDS);

    const response = await this.request(url);
    if (!response) return null;

    const body = (await response.json()) as OffProductResponse;
    if (body.status !== 1 || !body.product) return null;

    return normalizeProduct(body.product);
  }

  /**
   * Returns null (rather than throwing) on any network/HTTP failure -- a
   * provider outage should degrade the caller's results, not break the
   * whole request. Retries once, after a short delay, on a 5xx -- verified
   * against the real API while building this integration: Open Food
   * Facts' search endpoint genuinely does return an intermittent 503 under
   * normal use (observed on roughly half of a burst of real queries), not
   * just under sustained load, so a single retry meaningfully improves
   * real-world success without masking a truly down provider (which still
   * degrades to null after the retry also fails).
   */
  private async request(url: URL, attempt = 0): Promise<Response | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status >= 500 && attempt < 1) {
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          return this.request(url, attempt + 1);
        }
        this.logger.warn(`Open Food Facts request failed: ${response.status} ${url.pathname}`);
        return null;
      }
      return response;
    } catch (err) {
      this.logger.warn(
        `Open Food Facts request errored: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
