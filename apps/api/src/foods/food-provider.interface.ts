/**
 * A food normalized to Progresso's own shape, regardless of which external
 * provider it came from. Every field a provider genuinely didn't supply is
 * `null` here -- never a fabricated 0 or guessed value (see each provider's
 * own normalization comments for exactly when a field is left null vs. the
 * whole product is dropped for being unusable).
 */
export interface NormalizedFood {
  /** Which provider this came from -- e.g. 'open_food_facts'. Never null: only externally-sourced foods use this type at all. */
  provider: string;
  /** The provider's own id for this product (Open Food Facts uses its barcode as the product id). Stable across searches, so re-searching the same product upserts the same row instead of duplicating it. */
  providerFoodId: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  /** Null when the provider has no product photo -- never a placeholder/stock image. */
  imageUrl: string | null;
  servingSize: number;
  servingUnit: string;
  /** Null only when the provider genuinely has no calorie figure at all -- searchFoods() drops such products rather than returning a near-empty result (see FoodsService). */
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export interface FoodSearchResult {
  foods: NormalizedFood[];
  hasMore: boolean;
}

/**
 * The one seam between Progresso's Nutrition search and whichever external
 * food database actually backs it. FoodsService (the only caller) depends
 * on this interface, never on a specific provider's SDK/response shape --
 * adding or swapping a provider means writing one new class, not touching
 * FoodsService, the controller, or the mobile app.
 */
export interface FoodProvider {
  /** A short, stable identifier for this provider -- stored as NormalizedFood.provider / public.foods.provider, so it must never change once any product from this provider has been cached. */
  readonly name: string;

  searchFoods(query: string, page: number, pageSize: number): Promise<FoodSearchResult>;

  getFood(providerFoodId: string): Promise<NormalizedFood | null>;

  /** Backs the Scan Barcode flow -- see FoodsService.getByBarcode / GET /foods/barcode/:barcode. */
  getFoodByBarcode(barcode: string): Promise<NormalizedFood | null>;
}

export const FOOD_PROVIDER = Symbol('FOOD_PROVIDER');
