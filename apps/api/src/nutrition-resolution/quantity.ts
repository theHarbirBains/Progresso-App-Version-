// Works out how much of a candidate's published figures an amount corresponds to.
// Every figure is relative to the source's own basis (100 g, or one labelled serving),
// so the factor returned is what gets applied to the basis figures.

import { convertQuantity, normalizeUnit, unitGroup } from '../foods/nutrition-units';
import type { Nutrients, SourceCandidate } from './source.interface';

export interface Amount {
  amount: number;
  unit: string;
}

export type ScaleResult =
  | {
      ok: true;
      /** Multiply the candidate's basis figures by this to get the amount's figures. */
      factor: number;
      via: 'same_family' | 'grams' | 'measure';
      /** True when the amount is exactly a figure the source publishes (1 basis, or a published measure). */
      exact: boolean;
      grams: number | null;
    }
  | { ok: false; reason: 'invalid_amount' | 'no_conversion' | 'ambiguous_count' };

const GENERIC_COUNTS = new Set(['item', 'items', 'serving', 'servings', 'piece', 'pieces']);

function gramsOf(amount: Amount, candidate: SourceCandidate): number | null {
  const unit = normalizeUnit(amount.unit);
  if (unitGroup(unit) === 'mass') return convertQuantity(amount.amount, unit, 'g');
  const measure = candidate.measures.find((m) => normalizeUnit(m.unit) === unit);
  if (!measure || !(measure.amount > 0) || !(measure.grams > 0)) return null;
  return (amount.amount / measure.amount) * measure.grams;
}

export function scaleFor(amount: Amount, candidate: SourceCandidate): ScaleResult {
  if (!(amount.amount > 0)) return { ok: false, reason: 'invalid_amount' };
  const unit = normalizeUnit(amount.unit);
  if (GENERIC_COUNTS.has(unit)) return { ok: false, reason: 'ambiguous_count' };

  const basis = candidate.basis;
  const basisAmount: Amount =
    basis.kind === 'per_100g'
      ? { amount: 100, unit: 'g' }
      : { amount: basis.size, unit: basis.unit };

  // 0. The very same count unit as the basis ("2 large" against a "large" serving): a plain
  // count, exact, no conversion involved.
  if (unit === normalizeUnit(basisAmount.unit) && unitGroup(unit) === 'count') {
    const factor = amount.amount / basisAmount.amount;
    return {
      ok: true,
      factor,
      via: 'same_family',
      exact: Math.abs(factor - 1) < 1e-9,
      grams: null,
    };
  }

  // 1. Same family: exact, no density involved.
  const converted = convertQuantity(amount.amount, unit, basisAmount.unit);
  if (converted !== null && unitGroup(unit) !== 'count') {
    const factor = converted / basisAmount.amount;
    // Mass amounts know their grams exactly; a volume amount does not, and
    // none is needed, so it stays null rather than being guessed.
    const massGrams = unitGroup(unit) === 'mass' ? convertQuantity(amount.amount, unit, 'g') : null;
    return {
      ok: true,
      factor,
      via: 'same_family',
      exact: Math.abs(factor - 1) < 1e-9,
      grams: massGrams,
    };
  }

  // 2. Grams, from the amount directly or from this food's published measure.
  const grams = gramsOf(amount, candidate);
  const basisGrams = gramsOf(basisAmount, candidate);
  if (grams === null || basisGrams === null || !(basisGrams > 0)) {
    return { ok: false, reason: 'no_conversion' };
  }
  const measure = candidate.measures.find((m) => normalizeUnit(m.unit) === unit);
  const viaMeasure = unitGroup(unit) !== 'mass';
  return {
    ok: true,
    factor: grams / basisGrams,
    via: viaMeasure ? 'measure' : 'grams',
    exact: viaMeasure && measure !== undefined && Math.abs(amount.amount - measure.amount) < 1e-9,
    grams,
  };
}

export function scaleNutrients(basis: Nutrients, factor: number): Nutrients {
  return {
    calories: Math.round(basis.calories * factor),
    proteinG: Math.round(basis.proteinG * factor * 10) / 10,
    carbsG: Math.round(basis.carbsG * factor * 10) / 10,
    fatG: Math.round(basis.fatG * factor * 10) / 10,
  };
}
