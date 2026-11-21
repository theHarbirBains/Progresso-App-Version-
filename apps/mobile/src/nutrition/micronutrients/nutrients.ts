import { NUTRIENTS } from './nutrientCatalog.generated';
import type { NutrientCategory, NutrientDefinition, NutrientUnit } from './nutrientTypes';

// The micronutrients tracked (nutrientCatalog.generated.ts, from supabase/nutrients) and the
// amounts foods and logs hold of them. Pure.
//
// An amount object maps a nutrient id to an amount in that nutrient's unit. A nutrient the food's
// data didn't give is absent -- never 0 -- so "unknown" and "none" stay apart all the way through.

export type NutrientId = (typeof NUTRIENTS)[number]['id'];

/** Nutrient id to amount, in each nutrient's unit: only the ones known. */
export type NutrientAmounts = Readonly<Partial<Record<NutrientId, number>>>;

const BY_ID = new Map<string, NutrientDefinition>(NUTRIENTS.map((n) => [n.id, n]));

export function nutrientById(id: string): NutrientDefinition | undefined {
  return BY_ID.get(id);
}

export function nutrientsIn(category: NutrientCategory): NutrientDefinition[] {
  return NUTRIENTS.filter((n) => n.category === category);
}

/** Amounts as stored (a jsonb object), keeping only real ones: known ids, finite and 0 or more. */
export function readAmounts(value: unknown): NutrientAmounts | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const amounts: Partial<Record<NutrientId, number>> = {};
  for (const [id, amount] of Object.entries(value as Record<string, unknown>)) {
    const number = typeof amount === 'string' ? Number(amount) : amount;
    if (BY_ID.has(id) && typeof number === 'number' && Number.isFinite(number) && number >= 0) {
      amounts[id as NutrientId] = number;
    }
  }
  return Object.keys(amounts).length > 0 ? amounts : null;
}

const round4 = (value: number) => Math.round(value * 10000) / 10000;

/**
 * Amounts times `factor` -- a food's per serving for the servings logged, or a log's for a new
 * quantity. Null stays null: nothing known is still nothing known.
 */
export function scaleAmounts(
  amounts: NutrientAmounts | null | undefined,
  factor: number,
): NutrientAmounts | null {
  if (!amounts || !Number.isFinite(factor) || factor < 0) return null;
  const scaled: Partial<Record<NutrientId, number>> = {};
  for (const [id, amount] of Object.entries(amounts)) {
    scaled[id as NutrientId] = round4((amount as number) * factor);
  }
  return Object.keys(scaled).length > 0 ? scaled : null;
}

const UNIT_LABELS: Record<NutrientUnit, string> = { mcg: 'mcg', mg: 'mg', g: 'g' };

/**
 * An amount as shown: whole above 10 ("1,250", "68"), one place below ("2.4"), two below 1
 * ("0.45") -- enough to tell the small B vitamins apart without false precision elsewhere.
 */
export function formatAmount(value: number): string {
  const places = value >= 10 ? 0 : value >= 1 ? 1 : value > 0 ? 2 : 0;
  const rounded = Number(value.toFixed(places));
  return rounded.toLocaleString('en-US', { maximumFractionDigits: places });
}

/** "68 mg", "2.4 mcg". */
export function formatWithUnit(value: number, unit: NutrientUnit): string {
  return `${formatAmount(value)} ${UNIT_LABELS[unit]}`;
}

/** Its unit with how it's counted: "mcg RAE", "mg". */
export function unitWithBasis(nutrient: NutrientDefinition): string {
  return nutrient.basis && nutrient.basis.length <= 4
    ? `${UNIT_LABELS[nutrient.unit]} ${nutrient.basis}`
    : UNIT_LABELS[nutrient.unit];
}
