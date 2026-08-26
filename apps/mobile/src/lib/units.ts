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
