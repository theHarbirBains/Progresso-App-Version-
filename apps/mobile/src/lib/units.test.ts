import {
  formatWeight,
  formatWeightKg,
  fromKg,
  isValidWeightIncrement,
  roundWeight,
  toKg,
} from './units';

describe('toKg', () => {
  it('returns the value unchanged for kg', () => {
    expect(toKg(100, 'kg')).toBe(100);
  });

  it('converts lb to kg', () => {
    expect(toKg(220.462, 'lb')).toBeCloseTo(100, 1);
  });
});

describe('fromKg', () => {
  it('returns the value unchanged for kg', () => {
    expect(fromKg(100, 'kg')).toBe(100);
  });

  it('converts kg to lb', () => {
    expect(fromKg(100, 'lb')).toBeCloseTo(220.462, 1);
  });
});

describe('toKg/fromKg round-trip', () => {
  it('round-trips within floating point tolerance', () => {
    const original = 135;
    const roundTripped = fromKg(toKg(original, 'lb'), 'lb');
    expect(roundTripped).toBeCloseTo(original, 6);
  });
});

describe('roundWeight', () => {
  it('rounds to 2 decimal places', () => {
    expect(roundWeight(100.126)).toBe(100.13);
    expect(roundWeight(100.124)).toBe(100.12);
  });

  it('leaves already-precise values unchanged', () => {
    expect(roundWeight(100)).toBe(100);
    expect(roundWeight(100.5)).toBe(100.5);
  });
});

describe('isValidWeightIncrement', () => {
  it('accepts whole numbers', () => {
    expect(isValidWeightIncrement(0)).toBe(true);
    expect(isValidWeightIncrement(1)).toBe(true);
    expect(isValidWeightIncrement(100)).toBe(true);
  });

  it('accepts .5 increments', () => {
    expect(isValidWeightIncrement(1.5)).toBe(true);
    expect(isValidWeightIncrement(2.5)).toBe(true);
    expect(isValidWeightIncrement(100.5)).toBe(true);
  });

  it('rejects arbitrary decimal precision', () => {
    expect(isValidWeightIncrement(1.1)).toBe(false);
    expect(isValidWeightIncrement(1.25)).toBe(false);
    expect(isValidWeightIncrement(1.75)).toBe(false);
    expect(isValidWeightIncrement(100.25)).toBe(false);
    expect(isValidWeightIncrement(100.75)).toBe(false);
  });

  it('rejects non-finite values', () => {
    expect(isValidWeightIncrement(NaN)).toBe(false);
    expect(isValidWeightIncrement(Infinity)).toBe(false);
  });

  it('applies the same .5 step regardless of unit -- clean, round entries in kg (e.g. 100, 120) stay valid rather than being rejected for not matching an lb-derived fraction', () => {
    expect(isValidWeightIncrement(220.5)).toBe(true); // e.g. 220.5 lb
    expect(isValidWeightIncrement(100.5)).toBe(true); // e.g. 100.5 kg
    expect(isValidWeightIncrement(120)).toBe(true); // e.g. 120 kg
  });
});

describe('formatWeight / formatWeightKg', () => {
  it('shows a whole number as-is and anything else with one decimal', () => {
    expect(formatWeight(100)).toBe('100');
    expect(formatWeight(102.5)).toBe('102.5');
    expect(formatWeight(102.25)).toBe('102.3');
  });

  it('never shows a trailing .0 -- a value that rounds to a whole number is a whole number', () => {
    expect(formatWeight(224.97)).toBe('225');
    expect(formatWeight(225.04)).toBe('225');
    expect(formatWeight(99.96)).toBe('100');
    expect(formatWeight(225.0)).toBe('225');
    expect(formatWeight(0.04)).toBe('0');
    expect(formatWeight(102.5)).toBe('102.5');
  });

  it('shows a converted lb weight that lands on a whole number without a decimal', () => {
    // 102.05 kg is 224.97 lb.
    expect(formatWeightKg(102.05, 'lb')).toBe('225');
  });

  it('converts canonical kg to the display unit, rounded to the stored precision, then formats it', () => {
    expect(formatWeightKg(100, 'kg')).toBe('100');
    expect(formatWeightKg(100, 'lb')).toBe('220.5');
    expect(formatWeightKg(45.359237, 'lb')).toBe('100');
  });
});
