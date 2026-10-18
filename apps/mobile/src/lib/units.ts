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
 * The smallest step a weight can be entered in: 0.25, in either unit (100,
 * 100.25, 100.5, 100.75). Fine enough for 1.25 kg plates (61.25 kg) and
 * fractional plates, and the same step in kg and lb rather than a converted
 * one: plates come in their own increments per unit system, so a kg lifter's
 * round entries (100, 120) stay valid.
 */
export const WEIGHT_STEP = 0.25;

/**
 * Whether a weight value a user typed is a valid increment -- a multiple of
 * WEIGHT_STEP, never arbitrary decimal precision (100.1, 100.3). Applied to
 * the raw value in whichever unit the user is actually entering it in (kg or
 * lb) -- this is a constraint on user input, not on the converted/stored kg
 * value, so it must run before toKg.
 */
export function isValidWeightIncrement(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const steps = value / WEIGHT_STEP;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

/**
 * A weight in its display unit, snapped to the nearest WEIGHT_STEP. Storage
 * rounds kg to 2dp, which moves a pound weight by at most ~0.01 lb -- far
 * less than the 0.125 lb it takes to reach the next step -- so snapping
 * recovers exactly what was entered.
 */
export function snapToWeightStep(value: number): number {
  return Math.round(value / WEIGHT_STEP) * WEIGHT_STEP;
}

// How close a value must be to an entry step to be shown as that step: enough to
// absorb storage rounding (at most ~0.01 lb), far from a real measurement in between.
const STEP_TOLERANCE = 0.02;

/**
 * A weight for display: "100", "102.5", "61.25", "176.4" -- never a trailing
 * zero. A value within storage rounding of an entry step (a set entered in
 * this unit) shows as exactly that step, so 52.25 lb stored as kg reads
 * "52.25"; anything else (a converted body weight, a kg set shown in lb) shows
 * with one decimal, so 224.97 lb reads "225". Takes a value already in the
 * unit being shown.
 */
export function formatWeight(value: number): string {
  const step = snapToWeightStep(value);
  const shown = Math.abs(value - step) < STEP_TOLERANCE ? step : Math.round(value * 10) / 10;
  return String(Number(shown.toFixed(2)));
}

/** A canonical-kg weight formatted in the user's display unit, rounded to the stored precision first. */
export function formatWeightKg(kg: number, unit: 'kg' | 'lb'): string {
  return formatWeight(roundWeight(fromKg(kg, unit)));
}
