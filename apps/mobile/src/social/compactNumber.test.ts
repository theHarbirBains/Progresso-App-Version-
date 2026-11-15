import { compactNumber } from './compactNumber';

describe('compactNumber', () => {
  it('shortens thousands and millions', () => {
    expect(compactNumber(950)).toBe('950');
    expect(compactNumber(42_800)).toBe('42.8K');
    expect(compactNumber(100_000)).toBe('100K');
    expect(compactNumber(1_250_000)).toBe('1.25M');
    expect(compactNumber(999.9)).toBe('999');
  });
});
