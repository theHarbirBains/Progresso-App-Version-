import {
  bodyWeightRange,
  bodyWeightText,
  cmFromFeetAndInches,
  cmToInches,
  decimalRange,
  feetAndInchesFromCm,
  inchesToCm,
  intRange,
  kgToLb,
  lbToKg,
  nearestValue,
  typedBodyWeightKg,
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

describe('a typed body weight', () => {
  it('reads a weight in its unit, in kg, a comma counting as a point', () => {
    expect(typedBodyWeightKg('75', 'kg')).toBe(75);
    expect(typedBodyWeightKg(' 75,5 ', 'kg')).toBe(75.5);
    expect(typedBodyWeightKg('165', 'lb')).toBeCloseTo(74.84, 2);
  });

  it("isn't a weight while blank, unfinished, or out of the unit's range", () => {
    for (const text of ['', '7.', '.5', '1.2.3', 'abc', '-70']) {
      expect(typedBodyWeightKg(text, 'kg')).toBeNull();
    }
    expect(typedBodyWeightKg('29.9', 'kg')).toBeNull();
    expect(typedBodyWeightKg('251', 'kg')).toBeNull();
    // 60 is a weight in kg, but too light in lb.
    expect(typedBodyWeightKg('60', 'kg')).toBe(60);
    expect(typedBodyWeightKg('60', 'lb')).toBeNull();
    expect(bodyWeightRange('lb')).toEqual({ min: 66, max: 550, step: 0.1 });
  });

  it('is shown to a tenth, without a trailing .0', () => {
    expect(bodyWeightText(75, 'kg')).toBe('75');
    expect(bodyWeightText(lbToKg(165), 'lb')).toBe('165');
    expect(bodyWeightText(75, 'lb')).toBe('165.3');
  });
});
