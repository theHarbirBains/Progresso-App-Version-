import {
  cmFromFeetAndInches,
  cmToInches,
  decimalRange,
  feetAndInchesFromCm,
  inchesToCm,
  intRange,
  kgToLb,
  lbToKg,
  nearestValue,
} from './weightHeightConversion';

describe('weight conversion', () => {
  it('round-trips kg -> lb -> kg without drifting', () => {
    const kg = 79.2;
    expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 5);
  });

  it('matches a known reference value (79.2kg ~= 174.6lb)', () => {
    expect(kgToLb(79.2)).toBeCloseTo(174.6, 1);
  });
});

describe('height conversion', () => {
  it('round-trips cm -> inches -> cm without drifting', () => {
    const cm = 174;
    expect(inchesToCm(cmToInches(cm))).toBeCloseTo(cm, 5);
  });

  it('converts 174cm to 5 ft 9 in (matching the spec example)', () => {
    expect(feetAndInchesFromCm(174)).toEqual({ feet: 5, inches: 9 });
  });

  it('converts feet/inches back to the same cm value it came from', () => {
    const { feet, inches } = feetAndInchesFromCm(180);
    expect(Math.round(cmFromFeetAndInches(feet, inches))).toBe(180);
  });
});

describe('decimalRange / intRange', () => {
  it('generates an inclusive range at the given decimal step', () => {
    expect(decimalRange(30, 30.3, 0.1)).toEqual(['30.0', '30.1', '30.2', '30.3']);
  });

  it('generates an inclusive integer range', () => {
    expect(intRange(3, 6)).toEqual(['3', '4', '5', '6']);
  });
});

describe('nearestValue', () => {
  it('picks the closest string value to a raw number', () => {
    const values = decimalRange(30, 32, 0.1);
    expect(nearestValue(values, 31.04)).toBe('31.0');
    expect(nearestValue(values, 31.06)).toBe('31.1');
  });
});
