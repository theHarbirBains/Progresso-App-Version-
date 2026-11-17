import type { FoodLogRow } from './foodLogQueries';
import { estimatedWeekSoFar, weekdayNames, weekLogging, weekRangeText } from './weekLogging';

const SUNDAY = new Date(2026, 9, 18);

function log(id: string, day: number, calories: number, hour = 12): FoodLogRow {
  return {
    id,
    foodId: 'food-1',
    foodNameSnapshot: 'Food',
    servingSize: 1,
    servingUnit: 'serving',
    quantity: 1,
    calories,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    loggedAt: new Date(2026, 9, day, hour).toISOString(),
  } as FoodLogRow;
}

describe('weekLogging', () => {
  it('counts the days before the one shown, logged and not, and what the logged ones averaged', () => {
    // Wednesday shown: Sunday (two foods) and Tuesday logged, Monday not; Wednesday's own ignored.
    const logging = weekLogging(
      [log('a', 18, 1000, 8), log('b', 18, 800, 19), log('c', 20, 2000), log('d', 21, 500)],
      SUNDAY,
      '2026-10-21',
    );

    expect(logging).toEqual({
      daysBefore: 3,
      loggedBefore: 2,
      unloggedBefore: ['2026-10-19'],
      averageLoggedDay: 1900,
    });
  });

  it('has no days before a Sunday, and ignores another week', () => {
    expect(weekLogging([log('a', 17, 3000)], SUNDAY, '2026-10-18')).toEqual({
      daysBefore: 0,
      loggedBefore: 0,
      unloggedBefore: [],
      averageLoggedDay: null,
    });
  });

  it('a week with nothing logged before the day shown has no average to estimate from', () => {
    const logging = weekLogging([], SUNDAY, '2026-10-20');
    expect(logging.unloggedBefore).toEqual(['2026-10-18', '2026-10-19']);
    expect(estimatedWeekSoFar(500, logging)).toBeNull();
  });
});

describe('estimatedWeekSoFar', () => {
  it("adds the logged days' average for each unlogged day, and nothing when none is missing", () => {
    const logging = weekLogging([log('a', 18, 1800), log('c', 20, 2000)], SUNDAY, '2026-10-21');
    expect(estimatedWeekSoFar(4130, logging)).toBe(6030);
    const complete = weekLogging([log('a', 18, 1800)], SUNDAY, '2026-10-19');
    expect(estimatedWeekSoFar(1800, complete)).toBeNull();
  });
});

describe('week wording', () => {
  it('names the week by its dates, across a month too', () => {
    expect(weekRangeText(SUNDAY)).toBe('Oct 18 – 24');
    expect(weekRangeText(new Date(2026, 10, 29))).toBe('Nov 29 – Dec 5');
  });

  it('names days by their short weekday', () => {
    expect(weekdayNames(['2026-10-19', '2026-10-20'])).toBe('Mon, Tue');
  });
});
