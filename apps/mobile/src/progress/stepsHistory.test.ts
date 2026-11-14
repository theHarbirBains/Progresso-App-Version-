import type { DaySteps } from '../health/steps';
import { STEPS_WEEKS, stepsDaysToRead, stepsHistory } from './stepsHistory';

/** Days from `first` ("YYYY-MM-DD") on, each with the next count. */
function daysFrom(first: string, counts: number[]): DaySteps[] {
  const [year, month, date] = first.split('-').map(Number);
  return counts.map((steps, i) => {
    const at = new Date(year, month - 1, date + i);
    const pad = (n: number) => String(n).padStart(2, '0');
    return { day: `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`, steps };
  });
}

// Friday, November 13, 2026, mid-afternoon.
const NOW = new Date(2026, 10, 13, 15, 42);

describe('stepsDaysToRead', () => {
  it('reads back to the Monday three weeks before this one', () => {
    // Monday, October 19 to Friday, November 13.
    expect(stepsDaysToRead(NOW)).toBe(26);
    expect(STEPS_WEEKS).toBe(4);
  });

  it('is exactly 4 weeks on a Sunday, and 3 weeks and a day on a Monday', () => {
    expect(stepsDaysToRead(new Date(2026, 10, 15, 9))).toBe(28);
    expect(stepsDaysToRead(new Date(2026, 10, 9, 9))).toBe(22);
  });

  it('counts calendar days across a clock change', () => {
    // US clocks went back on November 1, 2026; the Monday three weeks before is October 12.
    expect(stepsDaysToRead(new Date(2026, 10, 2, 8))).toBe(22);
  });
});

describe('stepsHistory', () => {
  // October 19 (Monday) to November 13 (Friday): 26 days, 1,000 a day plus 100 per day after.
  const days = daysFrom(
    '2026-10-19',
    Array.from({ length: 26 }, (_, i) => 1000 + i * 100),
  );

  it("has today's count and the last 7 days, today last", () => {
    const history = stepsHistory(days, NOW);
    expect(history.today).toBe(3500);
    expect(history.lastSevenDays.map((day) => day.day)).toEqual([
      '2026-11-07',
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
    ]);
    expect(history.lastSevenDays.at(-1)?.steps).toBe(3500);
  });

  it('averages the 7 whole days before today, so it does not drop each morning', () => {
    // November 6 to 12: 2,800 to 3,400.
    expect(stepsHistory(days, NOW).sevenDayAverage).toBe(3100);
  });

  it('totals weeks Monday to Sunday, this week first and so far', () => {
    const { weeks, thisWeek } = stepsHistory(days, NOW);
    expect(weeks).toHaveLength(4);
    // This week: Monday November 9 (3,100) to today (3,500).
    expect(weeks[0]).toMatchObject({ current: true, total: 16500, dailyAverage: 3300 });
    expect(thisWeek).toBe(16500);
    expect(weeks[0].start).toEqual(new Date(2026, 10, 9));
    // November 2 to 8: 2,400 to 3,000.
    expect(weeks[1]).toMatchObject({ current: false, total: 18900, dailyAverage: 2700 });
    expect(weeks[3].start).toEqual(new Date(2026, 9, 19));
    expect(weeks[3].total).toBe(9100);
  });

  it('counts a day Apple Health has nothing for as 0, never skipping it', () => {
    const history = stepsHistory(daysFrom('2026-11-12', [4000]), NOW);
    expect(history.today).toBe(0);
    expect(history.lastSevenDays.map((day) => day.steps)).toEqual([0, 0, 0, 0, 0, 4000, 0]);
    expect(history.sevenDayAverage).toBe(571);
    expect(history.weeks[0]).toMatchObject({ total: 4000, dailyAverage: 800 });
    expect(history.weeks[3].total).toBe(0);
  });
});
