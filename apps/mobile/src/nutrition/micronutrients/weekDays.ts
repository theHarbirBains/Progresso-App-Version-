import { dayFromKey, dayKey } from '../../lib/dayKey';
import type { FoodLogRow } from '../foodLogQueries';
import { shiftDay } from '../logDay';

// A week's days for the Micronutrients page's averages, and its logs by day. Pure.

/**
 * The days of `day`'s week -- Sunday to Saturday, the week the Nutrition screen's budget counts --
 * up to today: a day ahead isn't counted until it comes.
 */
export function weekDayKeys(day: string, now: Date = new Date()): string[] {
  const sunday = shiftDay(day, -dayFromKey(day).getDay());
  const today = dayKey(now);
  return Array.from({ length: 7 }, (_, i) => shiftDay(sunday, i)).filter((key) => key <= today);
}

/** Logs grouped into those days, in order: a day with nothing logged is an empty list. */
export function logsByDay(logs: readonly FoodLogRow[], days: readonly string[]): FoodLogRow[][] {
  const byDay = new Map(days.map((key) => [key, [] as FoodLogRow[]]));
  for (const log of logs) byDay.get(dayKey(new Date(log.loggedAt)))?.push(log);
  return days.map((key) => byDay.get(key)!);
}
