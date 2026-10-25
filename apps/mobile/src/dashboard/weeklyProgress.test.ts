import { getCurrentWeekRange } from './weeklyProgress';

describe('getCurrentWeekRange', () => {
  it('returns Sunday..the following Sunday for a mid-week date', () => {
    // 2026-09-09 is a Wednesday.
    const { start, end } = getCurrentWeekRange(new Date('2026-09-09T12:00:00'));

    expect(start.toDateString()).toBe(new Date('2026-09-06T00:00:00').toDateString()); // Sunday
    expect(end.toDateString()).toBe(new Date('2026-09-13T00:00:00').toDateString()); // next Sunday
  });

  it('treats Saturday as the last day of its week', () => {
    // 2026-09-12 is a Saturday.
    const { start, end } = getCurrentWeekRange(new Date('2026-09-12T23:30:00'));

    expect(start.toDateString()).toBe(new Date('2026-09-06T00:00:00').toDateString());
    expect(end.toDateString()).toBe(new Date('2026-09-13T00:00:00').toDateString());
  });

  it('starts a new week on Sunday', () => {
    // 2026-09-13 is a Sunday.
    const { start, end } = getCurrentWeekRange(new Date('2026-09-13T08:00:00'));

    expect(start.toDateString()).toBe(new Date('2026-09-13T00:00:00').toDateString());
    expect(end.toDateString()).toBe(new Date('2026-09-20T00:00:00').toDateString());
  });
});
