import { fromKg, roundWeight, toKg } from './units';

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
