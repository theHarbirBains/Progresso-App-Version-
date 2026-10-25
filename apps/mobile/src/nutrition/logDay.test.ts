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
  it('says Today and Yesterday', () => {
    expect(dayLabel('2026-10-24', now)).toBe('Today');
    expect(dayLabel('2026-10-23', now)).toBe('Yesterday');
  });

  it("names any other day, with the year only when it isn't this year", () => {
    const thisYear = dayLabel('2026-10-20', now);
    expect(thisYear).toContain('20');
    expect(thisYear).not.toContain('2026');
    expect(dayLabel('2025-12-31', now)).toContain('2025');
  });
});

describe('loggedAtFor', () => {
  it("logs today's food, and anything that isn't a past day, now", () => {
    expect(loggedAtFor(undefined, now)).toBeUndefined();
    expect(loggedAtFor('2026-10-24', now)).toBeUndefined();
    expect(loggedAtFor('2026-10-25', now)).toBeUndefined();
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
  it('moves to the day before on a swipe left', () => {
    expect(daySwipe(-100, 0, false)).toBe('previous');
    expect(daySwipe(-30, -0.8, true)).toBe('previous');
  });

  it('moves to the day after on a swipe right, but never past today', () => {
    expect(daySwipe(100, 0, true)).toBe('next');
    expect(daySwipe(30, 0.8, true)).toBe('next');
    expect(daySwipe(100, 0, false)).toBeNull();
  });

  it('moves nowhere on a short or slow drag', () => {
    expect(daySwipe(-40, 0.1, true)).toBeNull();
    expect(daySwipe(20, 2, true)).toBeNull();
    expect(daySwipe(0, 0, true)).toBeNull();
  });
});
