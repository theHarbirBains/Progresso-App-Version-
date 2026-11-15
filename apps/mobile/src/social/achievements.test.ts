import { badgesFor, compactNumber, featuredBadges } from './achievements';

const stats = (extra: object = {}) => ({
  workouts: 0,
  lastThirtyDays: 0,
  totalVolumeKg: 0,
  prCount: 0,
  bestMonthWorkouts: 0,
  ...extra,
});

const earned = (s: ReturnType<typeof stats>, unit: 'kg' | 'lb' = 'lb') =>
  badgesFor(s, unit)
    .filter((b) => b.earned)
    .map((b) => b.id);

describe('compactNumber', () => {
  it('shortens thousands and millions, never rounding up past what was done', () => {
    expect(compactNumber(950)).toBe('950');
    expect(compactNumber(42_800)).toBe('42.8K');
    expect(compactNumber(100_000)).toBe('100K');
    expect(compactNumber(1_250_000)).toBe('1.25M');
    expect(compactNumber(1_000_000)).toBe('1M');
    expect(compactNumber(999.9)).toBe('999');
  });
});

describe('badgesFor', () => {
  it('earns each workout milestone once it is reached', () => {
    expect(earned(stats({ workouts: 9 }))).toEqual([]);
    expect(earned(stats({ workouts: 100 }))).toEqual([
      'workouts-10',
      'workouts-50',
      'workouts-100',
    ]);
  });

  it('earns Consistency for a month of 12 workouts -- never a streak', () => {
    expect(earned(stats({ bestMonthWorkouts: 11 }))).toEqual([]);
    expect(earned(stats({ bestMonthWorkouts: 12 }))).toEqual(['consistency']);
  });

  it('counts the records held, the first one its own badge', () => {
    expect(earned(stats({ prCount: 1 }))).toEqual(['prs-1']);
    const first = badgesFor(stats({ prCount: 1 }), 'lb').find((b) => b.id === 'prs-1');
    expect(first).toMatchObject({ title: 'First PR', short: 'PR' });
  });

  it('measures what was lifted in the unit they read weights in', () => {
    // 1,000,000 lb is 453,592 kg.
    expect(earned(stats({ totalVolumeKg: 453_600 }), 'lb')).toEqual([
      'lifted-lb-100000',
      'lifted-lb-500000',
      'lifted-lb-1000000',
    ]);
    expect(earned(stats({ totalVolumeKg: 453_600 }), 'kg')).toEqual([
      'lifted-kg-50000',
      'lifted-kg-250000',
    ]);
    const million = badgesFor(stats(), 'lb').find((b) => b.id === 'lifted-lb-1000000');
    expect(million).toMatchObject({
      title: '1M lb Lifted',
      short: '1M',
      requirement: 'Lift 1M lb in all',
    });
  });

  it('has thirteen in all', () => {
    expect(badgesFor(stats(), 'kg')).toHaveLength(13);
  });
});

describe('featuredBadges', () => {
  it('shows the best earned of each kind, then what is next of each, five at most', () => {
    const all = badgesFor(
      stats({ workouts: 120, bestMonthWorkouts: 14, prCount: 24, totalVolumeKg: 19_400 }),
      'kg',
    );
    expect(featuredBadges(all).map((b) => b.id)).toEqual([
      'workouts-100',
      'consistency',
      'prs-10',
      'workouts-250',
      'prs-50',
    ]);
  });

  it('shows the first of each kind to aim for on a new profile', () => {
    expect(featuredBadges(badgesFor(stats(), 'lb')).map((b) => b.id)).toEqual([
      'workouts-10',
      'consistency',
      'prs-1',
      'lifted-lb-100000',
    ]);
  });
});
