import { DUPLICATE_WINDOW_MS, loggedJustNow } from './duplicateLog';

const NOW = Date.parse('2026-10-20T12:00:00.000Z');
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe('loggedJustNow', () => {
  it('is true for the same food logged a few seconds ago', () => {
    expect(loggedJustNow([{ foodId: 'oats', loggedAt: at(3_000) }], 'oats', NOW)).toBe(true);
  });

  it('is false once the window has passed, or for a different food', () => {
    expect(
      loggedJustNow([{ foodId: 'oats', loggedAt: at(DUPLICATE_WINDOW_MS) }], 'oats', NOW),
    ).toBe(false);
    expect(loggedJustNow([{ foodId: 'milk', loggedAt: at(1_000) }], 'oats', NOW)).toBe(false);
    expect(loggedJustNow([], 'oats', NOW)).toBe(false);
  });
});
