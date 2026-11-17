import { dayFromKey, dayKey } from '../lib/dayKey';
import type { FoodLogRow } from './foodLogQueries';
import { sumDailyTotals } from './nutritionCalculations';

// How completely a week has been logged, for the weekly calorie budget (WeeklyCalorieBudget). The
// week is the calendar week -- Sunday 12:00 AM to the next Sunday 12:00 AM, on the phone's own
// clock (getCurrentWeekRange) -- read again from the logs every time, never added up on the phone,
// so opening the app again can neither reset nor double it. A day with nothing logged is not a day
// of eating nothing: it's a day nobody logged. It's counted as missing, never as 0 eaten, and the
// budget says so. An estimate for the missing days is only ever offered, labelled, and kept apart
// from what was logged.

export interface WeekLogging {
  /** The week's days before the day shown. */
  daysBefore: number;
  /** Of those, the days with something logged. */
  loggedBefore: number;
  /** Of those, the days with nothing logged, by their keys, in order. */
  unloggedBefore: string[];
  /** What the logged days before the day shown averaged; null with none logged. */
  averageLoggedDay: number | null;
}

/**
 * How the week's days before the day shown were logged: which have foods, which have none, and
 * what the logged ones averaged. `rows` are the week's logs (any days); only those before the day
 * shown count, since the day shown is still being logged.
 */
export function weekLogging(rows: FoodLogRow[], weekStart: Date, shownKey: string): WeekLogging {
  const shown = dayFromKey(shownKey);
  const byDay = new Map<string, FoodLogRow[]>();
  for (const row of rows) {
    const logged = new Date(row.loggedAt);
    if (logged < weekStart || logged >= shown) continue;
    const key = dayKey(logged);
    byDay.set(key, [...(byDay.get(key) ?? []), row]);
  }

  const unloggedBefore: string[] = [];
  let loggedCalories = 0;
  let loggedBefore = 0;
  const day = new Date(weekStart);
  while (dayKey(day) < shownKey) {
    const key = dayKey(day);
    const logs = byDay.get(key);
    if (logs && logs.length > 0) {
      loggedBefore += 1;
      loggedCalories += sumDailyTotals(logs).calories;
    } else {
      unloggedBefore.push(key);
    }
    day.setDate(day.getDate() + 1);
  }

  return {
    daysBefore: loggedBefore + unloggedBefore.length,
    loggedBefore,
    unloggedBefore,
    averageLoggedDay: loggedBefore > 0 ? loggedCalories / loggedBefore : null,
  };
}

/**
 * An estimate of the week so far had the unlogged days been like the logged ones: what was logged,
 * plus the logged days' average for each day with nothing logged. Null when there's nothing missing
 * or nothing to base it on. It's never a total of what was eaten, and never shown as one.
 */
export function estimatedWeekSoFar(consumed: number, logging: WeekLogging): number | null {
  if (logging.unloggedBefore.length === 0 || logging.averageLoggedDay === null) return null;
  return consumed + logging.averageLoggedDay * logging.unloggedBefore.length;
}

/** The week's dates, Sunday to Saturday: "Nov 15 – 21", or "Nov 29 – Dec 5" across a month. */
export function weekRangeText(weekStart: Date): string {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const startText = weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endText =
    end.getMonth() === weekStart.getMonth()
      ? String(end.getDate())
      : end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${startText} – ${endText}`;
}

/** Days by their short weekday names: "Mon, Tue". */
export function weekdayNames(keys: string[]): string {
  return keys
    .map((key) => dayFromKey(key).toLocaleDateString(undefined, { weekday: 'short' }))
    .join(', ');
}
