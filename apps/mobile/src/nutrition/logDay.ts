import { dayFromKey, dayKey } from '../lib/dayKey';

// The day the Nutrition screen shows, and the day a food is logged to. Days are local
// "YYYY-MM-DD" keys (lib/dayKey.ts). Today is the shared, live food log (FoodLogProvider); any
// other day -- before today, or ahead of it, to plan -- is read for itself.

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

/**
 * The day's date, always -- "Saturday, October 24", with the year when it isn't this year's --
 * never "Yesterday": the day shown is named by its date (the day bar marks today besides).
 */
export function dayLabel(key: string, now: Date = new Date()): string {
  const day = dayFromKey(key);
  return day.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    ...(day.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

/** A week by its Sunday's key: "Week of October 18" -- with the year when it isn't this year's. */
export function weekOfLabel(sundayKey: string, now: Date = new Date()): string {
  const sunday = dayFromKey(sundayKey);
  const date = sunday.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    ...(sunday.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
  return `Week of ${date}`;
}

/**
 * When a food logged to `key` is logged: undefined (now) for today; for any other day -- before
 * today, or ahead of it -- that day at the current time of day, so its foods keep the order they
 * were added in.
 */
export function loggedAtFor(key: string | undefined, now: Date = new Date()): Date | undefined {
  if (key === undefined || isTodayKey(key, now)) return undefined;
  const day = dayFromKey(key);
  day.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
  return day;
}

export type DaySwipe = 'previous' | 'next' | null;

/**
 * Which way a horizontal swipe on the Nutrition screen moves, as pages turn: right to left (the
 * finger moving left) to the day after -- tomorrow and on, too -- and left to right to the day
 * before. A short or slow drag moves nowhere.
 */
export function daySwipe(dx: number, vx: number): DaySwipe {
  const far = Math.abs(dx) > 72 || (Math.abs(dx) > 24 && Math.abs(vx) > 0.5);
  if (!far) return null;
  return dx > 0 ? 'previous' : 'next';
}
