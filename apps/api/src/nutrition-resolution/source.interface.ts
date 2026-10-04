// Nutrition-resolution interfaces. Every nutrition source (Progresso catalog, Open Food
// Facts, USDA, a future Canadian file, a future paid provider) implements NutritionSource
// and returns SourceCandidate values. The resolver depends only on these types, never on a
// provider's own response shape.

/** Verified: directly from a recognised source. Calculated: verified data scaled or combined from a stated amount. AI estimate: no reliable source matched. */
export type Confidence = 'verified' | 'calculated' | 'ai_estimate';

export type SourceKind =
  | 'progresso_catalog'
  | 'open_food_facts'
  | 'usda_fdc'
  | 'canadian_nutrient_file'
  | 'chain_curated'
  | 'user_entered'
  | 'ai_estimate';

/** How the source's data may be stored. Drives whether a result can be cached into the Food Library. */
export type Licence = 'public_domain' | 'open_government' | 'odbl' | 'live_only' | 'none';

export interface Nutrients {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * What the figures in a candidate are for. USDA and most reference data state
 * values per 100 g. Packaged products state them per serving. Basis is always
 * explicit so no figure is ever read against the wrong amount.
 */
export type NutrientBasis =
  | { kind: 'per_100g'; nutrients: Nutrients }
  | { kind: 'per_serving'; size: number; unit: string; nutrients: Nutrients };

/** Grams for a household measure of this specific food, e.g. "cup" = 156 g. Per food, so it stays exact for volume and count units. */
export interface MeasureWeight {
  /** The measure as the source names it, e.g. "cup", "tbsp", "medium". */
  unit: string;
  amount: number;
  grams: number;
}

export interface SourceCandidate {
  sourceKind: SourceKind;
  /** The source's own identifier, e.g. a USDA fdcId or an Open Food Facts barcode. */
  sourceId: string;
  matchedName: string;
  brand: string | null;
  barcode: string | null;
  basis: NutrientBasis;
  measures: MeasureWeight[];
  /** Release or retrieval version of the data, so a figure can be traced to one dataset. */
  dataVersion: string;
  retrievedAt: string;
}

/** What the user asked for, after the AI parser has split it into parts. */
export interface FoodQuery {
  /** A generic food name, singular, with no preparation words, e.g. "potato". */
  term: string;
  brand: string | null;
  barcode: string | null;
  restaurant: string | null;
}

export interface NutritionSource {
  readonly kind: SourceKind;
  readonly licence: Licence;
  /** Whether results from this source may be written into the user's Food Library. */
  readonly storable: boolean;
  search(query: FoodQuery): Promise<SourceCandidate[]>;
  /** The attribution the licence requires to be shown with a result from this candidate. Null when none is required. */
  attribution(candidate: SourceCandidate): string | null;
}

/** Where a resolved component's figures came from. Stored with the food and shown to the user. */
export interface Provenance {
  confidence: Confidence;
  sourceKind: SourceKind;
  sourceId: string | null;
  matchedName: string | null;
  brand: string | null;
  dataVersion: string | null;
  retrievedAt: string | null;
  licence: Licence;
  /** The attribution a licence requires to be shown, e.g. the USDA release. Null when none is needed. */
  attribution: string | null;
  /** Assumptions the user should see, e.g. "Treated 2 items as 2 large eggs". */
  assumptions: string[];
}

export interface ResolvedComponent {
  name: string;
  quantity: { amount: number; unit: string };
  /** Null when the amount converted by volume against a same-family basis, where no gram weight is needed or known. */
  grams: number | null;
  nutrients: Nutrients;
  provenance: Provenance;
}
