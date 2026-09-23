import { getCurrentWeekRange } from './weeklyProgress';

describe('getCurrentWeekRange', () => {
  it('returns Monday..the following Monday for a mid-week date', () => {
    // 2026-09-09 is a Wednesday.
    const { start, end } = getCurrentWeekRange(new Date('2026-09-09T12:00:00'));

    expect(start.toDateString()).toBe(new Date('2026-09-07T00:00:00').toDateString()); // Monday
    expect(end.toDateString()).toBe(new Date('2026-09-14T00:00:00').toDateString()); // next Monday
  });

  it('treats Sunday as the last day of its week, not the start of the next one', () => {
    // 2026-09-13 is a Sunday.
    const { start, end } = getCurrentWeekRange(new Date('2026-09-13T12:00:00'));

    expect(start.toDateString()).toBe(new Date('2026-09-07T00:00:00').toDateString());
    expect(end.toDateString()).toBe(new Date('2026-09-14T00:00:00').toDateString());
  });

  it('starts exactly on Monday when `now` already is Monday', () => {
    const { start } = getCurrentWeekRange(new Date('2026-09-07T08:00:00'));

    expect(start.toDateString()).toBe(new Date('2026-09-07T00:00:00').toDateString());
  });
});
