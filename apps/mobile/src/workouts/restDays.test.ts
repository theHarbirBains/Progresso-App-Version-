import { firstWorkoutDayKey, restDayKeys } from './restDays';

describe('rest days', () => {
  it('are the days gone by with no workout, from the first workout on', () => {
    const rest = restDayKeys(
      2026,
      11,
      new Set(['2026-11-03', '2026-11-05']),
      '2026-11-03',
      '2026-11-08',
    );
    expect([...rest]).toEqual(['2026-11-04', '2026-11-06', '2026-11-07']);
  });

  it('are none before the person has trained', () => {
    expect(restDayKeys(2026, 11, new Set(), null, '2026-11-21').size).toBe(0);
  });

  it('cover a whole month gone by, and none of one still ahead', () => {
    expect(restDayKeys(2026, 2, new Set(), '2026-01-01', '2026-11-21').size).toBe(28);
    expect(restDayKeys(2026, 12, new Set(), '2026-01-01', '2026-11-21').size).toBe(0);
  });

  it('start from the earliest workout', () => {
    expect(
      firstWorkoutDayKey([
        { performedAt: new Date(2026, 10, 9, 18).toISOString() },
        { performedAt: new Date(2026, 9, 30, 7).toISOString() },
      ]),
    ).toBe('2026-10-30');
    expect(firstWorkoutDayKey([])).toBeNull();
  });
});
