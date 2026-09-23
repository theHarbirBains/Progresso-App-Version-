import { fromKg, toKg } from '../lib/units';

const CM_PER_INCH = 2.54;

// kg<->lb conversion itself is never redefined here -- lib/units.ts is the
// one place that constant/formula lives; these are just its lb-specific
// callers, kept for this file's own onboarding-specific callers (wheel
// picker ranges, feet/inches math) that only ever work in one direction.
export function kgToLb(kg: number): number {
  return fromKg(kg, 'lb');
}

export function lbToKg(lb: number): number {
  return toKg(lb, 'lb');
}

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

export function inchesToCm(inches: number): number {
  return inches * CM_PER_INCH;
}

/** Weight wheel range/step is unit-specific so each unit gets natural round numbers on its own scale, never a converted-and-rounded value from the other unit. */
export const WEIGHT_KG_RANGE = { min: 30, max: 250, step: 0.1 };
export const WEIGHT_LB_RANGE = { min: 66, max: 550, step: 0.1 };
export const HEIGHT_CM_RANGE = { min: 90, max: 250, step: 1 };
export const HEIGHT_FT_RANGE = { min: 3, max: 8 };
export const HEIGHT_IN_RANGE = { min: 0, max: 11 };

export function decimalRange(min: number, max: number, step: number): string[] {
  const values: string[] = [];
  const decimals = step < 1 ? 1 : 0;
  const count = Math.round((max - min) / step);
  for (let i = 0; i <= count; i++) {
    values.push((min + i * step).toFixed(decimals));
  }
  return values;
}

export function intRange(min: number, max: number): string[] {
  const values: string[] = [];
  for (let i = min; i <= max; i++) values.push(String(i));
  return values;
}

/** Snaps a raw numeric value to the nearest string present in a decimalRange/intRange array. */
export function nearestValue(values: string[], raw: number): string {
  let closest = values[0];
  let closestDiff = Math.abs(Number(closest) - raw);
  for (const value of values) {
    const diff = Math.abs(Number(value) - raw);
    if (diff < closestDiff) {
      closest = value;
      closestDiff = diff;
    }
  }
  return closest;
}

export function feetAndInchesFromCm(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round(cmToInches(cm));
  return { feet: Math.floor(totalInches / 12), inches: totalInches % 12 };
}

export function cmFromFeetAndInches(feet: number, inches: number): number {
  return inchesToCm(feet * 12 + inches);
}
