import { dayFromKey, dayKey } from '../lib/dayKey';

// The day the Nutrition screen shows, and the day a food is logged to. Days are local
// "YYYY-MM-DD" keys (lib/dayKey.ts). Today is the shared, live food log (FoodLogProvider); any
// other day is read for itself. Nothing ahead of today is shown or logged to.

export function todayKey(now: Date = new Date()): string {
  return dayKey(now);
}

export function isTodayKey(key: string, now: Date = new Date()): boolean {
  return key === dayKey(now);
}

/** Whether `key` is a day before today. */
export function isPastKey(key: string, now: Date = new Date()): boolean {
  return key < dayKey(now);
}

/** The day `days` after `key` (before, when negative). */
export function shiftDay(key: string, days: number): string {
  const day = dayFromKey(key);
  day.setDate(day.getDate() + days);
  return dayKey(day);
}

/** "Today", "Yesterday", or "Mon, Oct 20" -- with the year when it isn't this year's. */
export function dayLabel(key: string, now: Date = new Date()): string {
  if (isTodayKey(key, now)) return 'Today';
  if (key === shiftDay(dayKey(now), -1)) return 'Yesterday';
  const day = dayFromKey(key);
  return day.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(day.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/**
 * When a food logged to `key` is logged: undefined (now) for today, or for anything that isn't a
 * past day; for a past day, that day at the current time of day, so its foods keep the order
 * they were added in.
 */
export function loggedAtFor(key: string | undefined, now: Date = new Date()): Date | undefined {
  if (key === undefined || !isPastKey(key, now)) return undefined;
  const day = dayFromKey(key);
  day.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return day;
}

export type DaySwipe = 'previous' | 'next' | null;

/**
 * Which way a horizontal swipe on the Nutrition screen moves: left to the day before, right to
 * the day after -- never past today. A short or slow drag moves nowhere.
 */
export function daySwipe(dx: number, vx: number, canGoNext: boolean): DaySwipe {
  const far = Math.abs(dx) > 72 || (Math.abs(dx) > 24 && Math.abs(vx) > 0.5);
  if (!far) return null;
  if (dx < 0) return 'previous';
  return canGoNext ? 'next' : null;
}
