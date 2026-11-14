import { isSnowSeason } from './snowSeason';

describe('isSnowSeason', () => {
  it('is November and December, and January up to the 6th', () => {
    expect(isSnowSeason(new Date(2026, 10, 1))).toBe(true);
    expect(isSnowSeason(new Date(2026, 11, 25))).toBe(true);
    expect(isSnowSeason(new Date(2027, 0, 6, 23, 59))).toBe(true);
  });

  it('is never the rest of the year', () => {
    expect(isSnowSeason(new Date(2026, 9, 31))).toBe(false);
    expect(isSnowSeason(new Date(2027, 0, 7))).toBe(false);
    expect(isSnowSeason(new Date(2027, 6, 1))).toBe(false);
  });
});
