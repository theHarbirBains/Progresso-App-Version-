import { dayKey } from '../lib/dayKey';
import {
  dayLabel,
  daySwipe,
  isPastKey,
  isTodayKey,
  loggedAtFor,
  shiftDay,
  todayKey,
} from './logDay';

// A fixed local "now": Saturday, October 24, 2026, 3:45:10 pm.
const now = new Date(2026, 9, 24, 15, 45, 10, 500);

describe('the days', () => {
  it("knows today's key, and which keys are today and before it", () => {
    expect(todayKey(now)).toBe('2026-10-24');
    expect(isTodayKey('2026-10-24', now)).toBe(true);
    expect(isTodayKey('2026-10-23', now)).toBe(false);
    expect(isPastKey('2026-10-23', now)).toBe(true);
    expect(isPastKey('2026-10-24', now)).toBe(false);
    expect(isPastKey('2026-10-25', now)).toBe(false);
  });

  it('moves a day at a time, across months and years', () => {
    expect(shiftDay('2026-10-24', -1)).toBe('2026-10-23');
    expect(shiftDay('2026-10-24', 1)).toBe('2026-10-25');
    expect(shiftDay('2026-11-01', -1)).toBe('2026-10-31');
    expect(shiftDay('2027-01-01', -1)).toBe('2026-12-31');
    expect(shiftDay('2028-02-28', 1)).toBe('2028-02-29');
  });
});

describe('dayLabel', () => {
  it('names every day by its date -- today and yesterday too, never in words', () => {
    expect(dayLabel('2026-10-24', now)).toBe('Saturday, October 24');
    expect(dayLabel('2026-10-23', now)).toBe('Friday, October 23');
  });

  it("names any other day, with the year only when it isn't this year", () => {
    const thisYear = dayLabel('2026-10-20', now);
    expect(thisYear).toContain('20');
    expect(thisYear).not.toContain('2026');
    expect(dayLabel('2025-12-31', now)).toContain('2025');
  });
});

describe('loggedAtFor', () => {
  it("logs today's food now", () => {
    expect(loggedAtFor(undefined, now)).toBeUndefined();
    expect(loggedAtFor('2026-10-24', now)).toBeUndefined();
  });

  it('logs to a day ahead -- planning tomorrow -- on that day, at the current time of day', () => {
    const at = loggedAtFor('2026-10-25', now)!;
    expect(dayKey(at)).toBe('2026-10-25');
    expect(at.getHours()).toBe(15);
  });

  it('logs to a past day at the current time of day, on that day', () => {
    const at = loggedAtFor('2026-10-20', now)!;
    expect(dayKey(at)).toBe('2026-10-20');
    expect([at.getHours(), at.getMinutes(), at.getSeconds(), at.getMilliseconds()]).toEqual([
      15, 45, 10, 500,
    ]);
  });
});

describe('daySwipe', () => {
  it('moves to the day before on a swipe from left to right', () => {
    expect(daySwipe(100, 0)).toBe('previous');
    expect(daySwipe(30, 0.8)).toBe('previous');
  });

  it('moves to the day after on a swipe from right to left', () => {
    expect(daySwipe(-100, 0)).toBe('next');
    expect(daySwipe(-30, -0.8)).toBe('next');
  });

  it('moves nowhere on a short or slow drag', () => {
    expect(daySwipe(-40, 0.1)).toBeNull();
    expect(daySwipe(20, 2)).toBeNull();
    expect(daySwipe(0, 0)).toBeNull();
  });
});
