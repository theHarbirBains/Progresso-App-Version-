// The micronutrient catalogue's shapes (nutrientCatalog.generated.ts, written by
// supabase/nutrients/generate.mjs). Pure types.

export type DriPage = 'vitamins' | 'elements' | 'macronutrients';
export type NutrientCategory = 'vitamin' | 'mineral' | 'other';
export type NutrientUnit = 'mcg' | 'mg' | 'g';

/** A Health Canada life-stage group, as its tables name them. */
export type LifeStageGroup =
  'infants' | 'children' | 'males' | 'females' | 'pregnancy' | 'lactation';

/** Where an explanation comes from. */
export interface NutrientSource {
  publisher: string;
  title: string;
  url: string;
  /** The source's own review date, where it gives one. */
  reviewed?: string;
}

/** One of What it does / Too little / Too much: plain words, and the sources they're from. */
export interface NutrientExplanation {
  text: string;
  sources: readonly string[];
}

export interface NutrientDefinition {
  id: string;
  name: string;
  /** Its other name ("Vitamin B1" for thiamin). */
  altName?: string;
  category: NutrientCategory;
  unit: NutrientUnit;
  /** How the amount is counted, as Health Canada counts it (RAE, DFE, NE, alpha-tocopherol). */
  basis?: string;
  /** A qualification of how a logged amount compares with the reference. */
  note?: string;
  /** Health Canada's UL isn't about food (supplements or one form only): a logged total is never compared with it. */
  ulOnlySupplements?: boolean;
  driPage: DriPage;
  /** Health Canada's guidance where it gives no number ("As low as possible ..."). */
  guidance?: string;
  /** Health Canada's notes (DRI_FOOTNOTES keys): on the nutrient, its value, its UL and its CDRR. */
  footnotes: {
    nutrient: readonly string[];
    value: readonly string[];
    ul: readonly string[];
    cdrr: readonly string[];
  };
  /** Null where no source that could be read covers it. */
  about: {
    does: NutrientExplanation | null;
    low: NutrientExplanation | null;
    high: NutrientExplanation | null;
  };
}

/** One life stage's values for one nutrient, as Health Canada's table gives them. */
export interface ReferenceRow {
  group: LifeStageGroup;
  ageLabel: string;
  /** Ages it covers, in months from birth: from `ageMinMonths` up to (not including) `ageMaxMonths`. */
  ageMinMonths: number;
  ageMaxMonths: number | null;
  /** The RDA or AI; null where Health Canada set none. */
  value: number | null;
  type: 'RDA' | 'AI' | null;
  ear: number | null;
  /** The Tolerable Upper Intake Level; null where none was set ("ND"). */
  ul: number | null;
  /** Sodium's Chronic Disease Risk Reduction intake; null elsewhere. */
  cdrr: number | null;
  /** The same figures in IU, where the table gives them (vitamin D). */
  valueIu?: number | null;
  ulIu?: number | null;
  /** Health Canada's notes on this life stage's values (DRI_FOOTNOTES keys). */
  notes: readonly string[];
}
