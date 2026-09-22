// Weight is stored canonically in kilograms everywhere beyond this boundary
// (network, database). Conversion between the user's display/input
// preference and kg happens here, and only here.
const KG_PER_LB = 0.45359237;

export function toKg(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? value * KG_PER_LB : value;
}

export function fromKg(kg: number, unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? kg / KG_PER_LB : kg;
}

/** Rounds to 2 decimal places, matching sets.weight_kg's numeric(6,2). */
export function roundWeight(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Whether a weight value a user typed is a valid increment -- a whole
 * number or a .5 increment (100, 100.5), never arbitrary decimal precision
 * (100.25, 100.75). Applied to the raw value in whichever unit the user is
 * actually entering it in (kg or lb) -- this is a constraint on user input,
 * not on the converted/stored kg value, so it must run before toKg.
 *
 * Deliberately the same .5 step in either unit, not a converted "0.5 lb ==
 * ~0.2268 kg" step: real gym plates come in their own, independent
 * increments per unit system (lb plates as small as 2.5 lb; kg plates as
 * small as 0.5-1.25 kg), so a kg lifter's clean, round kg entries (e.g.
 * 100, 120) should stay valid rather than being rejected for not matching
 * an lb-derived fraction.
 */
export function isValidWeightIncrement(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const doubled = value * 2;
  return Math.abs(doubled - Math.round(doubled)) < 1e-9;
}

/**
 * A weight for display: a whole number, or one decimal place ("100", "102.5") --
 * never a trailing ".0". The value is rounded to one decimal FIRST, so a
 * converted 224.97 lb reads "225", not "225.0". Takes a value already in the
 * unit being shown.
 */
export function formatWeight(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** A canonical-kg weight formatted in the user's display unit, rounded to the stored precision first. */
export function formatWeightKg(kg: number, unit: 'kg' | 'lb'): string {
  return formatWeight(roundWeight(fromKg(kg, unit)));
}
