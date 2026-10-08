import { request } from './apiClient';

// Food search combines Progresso's own cached catalog with a live external
// provider (Open Food Facts) call on the backend -- never called directly
// from the mobile app, since that orchestration (provider call, dedup-safe
// caching) is real business logic, not a simple RLS-protected read. See
// apps/api/src/foods/.
export interface FoodSearchResult {
  id: string;
  name: string;
  brand: string | null;
  /** Null when the provider has no product photo -- never a placeholder image. */
  imageUrl: string | null;
  servingSize: number;
  servingUnit: string;
  calories: number;
  /** Null when the provider genuinely didn't report this macro -- never a fabricated 0. */
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  /** Null for Progresso's own generic/seeded foods; the source provider's id (e.g. 'open_food_facts') for a cached branded product. */
  provider: string | null;
  barcode: string | null;
}

export interface FoodSearchResponse {
  foods: FoodSearchResult[];
  hasMore: boolean;
}

export function searchFoods(
  accessToken: string,
  query: string,
  page = 0,
  pageSize = 30,
): Promise<FoodSearchResponse> {
  const params = new URLSearchParams({ query, page: String(page), pageSize: String(pageSize) });
  return request<FoodSearchResponse>(`/api/v1/foods/search?${params.toString()}`, accessToken);
}

/**
 * Scan Barcode's lookup step -- same provider-orchestration reasoning as
 * searchFoods (through the backend, never direct-to-Supabase). Resolves to
 * `null` (not a thrown error) when the product genuinely isn't found: a
 * missing barcode is Open Food Facts' normal "no match" outcome, not a
 * failure, so the backend returns a plain 200 with a null body for it (see
 * apps/api/src/foods/foods.controller.ts) -- only a real network/server
 * failure throws here, same as any other request() call.
 */
export function getFoodByBarcode(
  accessToken: string,
  barcode: string,
): Promise<FoodSearchResult | null> {
  return request<FoodSearchResult | null>(
    `/api/v1/foods/barcode/${encodeURIComponent(barcode)}`,
    accessToken,
  );
}

/** AI Food Search. The backend parses a description, then resolves each component against the
 * best source for it. Every component reports its own state, so a pending one can be resolved
 * without restarting the search. Figures come from data; an AI estimate is labelled as such.
 * Through the backend because it calls third-party services. */
export interface QuantityOption {
  label: string;
  amount: number;
  unit: string;
}

export interface Choice {
  sourceKind: 'progresso_catalog' | 'open_food_facts' | 'usda_fdc';
  sourceId: string;
  matchedName: string;
  brand: string | null;
  score: number;
  reasons: string[];
}

export interface ComponentRequest {
  index: number;
  role: 'main' | 'ingredient';
  name: string;
  term: string;
  brand: string | null;
  barcode: string | null;
  quantity: { amount: number; unit: string } | null;
}

export interface ComponentPick {
  sourceKind: Choice['sourceKind'];
  sourceId: string;
}

export interface NutrientFigures {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface ResolvedComponentFigures {
  name: string;
  quantity: { amount: number; unit: string };
  grams: number | null;
  nutrients: NutrientFigures;
  provenance: {
    confidence: 'verified' | 'calculated' | 'ai_estimate' | 'user_entered';
    sourceKind: string | null;
    sourceId: string | null;
    matchedName: string | null;
    brand: string | null;
    dataVersion: string | null;
    retrievedAt: string | null;
    licence: string;
    attribution: string | null;
    assumptions: string[];
  };
}

export type ComponentStatus =
  | { state: 'resolved'; request: ComponentRequest; component: ResolvedComponentFigures }
  | { state: 'ai_estimate'; request: ComponentRequest; component: ResolvedComponentFigures }
  | {
      state: 'needs_quantity';
      request: ComponentRequest;
      matchedName: string | null;
      options: QuantityOption[];
      reason: string;
    }
  | { state: 'choose'; request: ComponentRequest; choices: Choice[] }
  | { state: 'not_found'; request: ComponentRequest; reason: string };

export interface FoodInterpretation {
  name: string;
  preparation: string | null;
  components: ComponentStatus[];
  complete: boolean;
  servingSize: number | null;
  servingUnit: string | null;
  totals: NutrientFigures | null;
  hasEstimate: boolean;
}

export type InterpretFoodResponse =
  | { status: 'clarification'; question: string }
  | { status: 'ok'; interpretation: FoodInterpretation };

export function interpretFoodDescription(
  accessToken: string,
  description: string,
): Promise<InterpretFoodResponse> {
  return request<InterpretFoodResponse>('/api/v1/foods/interpret', accessToken, {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
}

/** Resolves one pending component: after the user picks a candidate, or gives an amount. */
export function resolveFoodComponent(
  accessToken: string,
  componentRequest: ComponentRequest,
  pick: ComponentPick | null,
): Promise<ComponentStatus> {
  return request<ComponentStatus>('/api/v1/foods/resolve-component', accessToken, {
    method: 'POST',
    body: JSON.stringify({ request: componentRequest, pick }),
  });
}
