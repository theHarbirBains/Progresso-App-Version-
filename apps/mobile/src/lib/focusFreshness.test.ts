import { isStale } from './focusFreshness';

describe('isStale', () => {
  it('is stale when it has never loaded', () => {
    expect(isStale(null)).toBe(true);
  });

  it('is not stale within the given window', () => {
    expect(isStale(Date.now() - 1000, 45_000)).toBe(false);
  });

  it('is stale once the window has passed', () => {
    expect(isStale(Date.now() - 46_000, 45_000)).toBe(true);
  });

  it('defaults to a 45s window when none is given', () => {
    expect(isStale(Date.now() - 1000)).toBe(false);
    expect(isStale(Date.now() - 46_000)).toBe(true);
  });
});
