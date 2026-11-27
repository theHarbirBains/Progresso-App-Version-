import type { DaySteps } from '../health/steps';
import { weekRange } from './weeklySummary';

// What Progress's Health tab shows of steps, worked out from Apple Health's daily counts (read on the
// phone, kept nowhere): today, the 7 days before it, and the last 4 weeks, Monday to Sunday like
// the Weekly Summary. A day Apple Health has nothing for is a 0, never skipped.

/** How many weeks Weekly Totals shows, this one included. */
export const STEPS_WEEKS = 4;

export interface StepsWeek {
  start: Date;
  end: Date;
  total: number;
  /** Over the days it's had so far: all 7 for a past week, up to today for this one. */
  dailyAverage: number;
  /** The week today falls in. */
  current: boolean;
}

export interface StepsHistory {
  today: number;
  /** The last 7 days, today last. */
  lastSevenDays: DaySteps[];
  /** The 7 days before today, averaged -- whole days only, so it doesn't drop each morning. */
  sevenDayAverage: number;
  thisWeek: number;
  /** Newest first, this week first. */
  weeks: StepsWeek[];
}

/** How many days back to read for the tab: back to the Monday `STEPS_WEEKS - 1` weeks ago. */
export function stepsDaysToRead(now: Date): number {
  const { start } = weekRange(now, STEPS_WEEKS - 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return calendarDaysBetween(start, today) + 1;
}

export function stepsHistory(days: DaySteps[], now: Date): StepsHistory {
  const byDay = new Map(days.map((day) => [day.day, day.steps]));
  const stepsOn = (date: Date) => byDay.get(dayKey(date)) ?? 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysAgo = (n: number) =>
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - n);

  const lastSevenDays = Array.from({ length: 7 }, (_, i) => {
    const date = daysAgo(6 - i);
    return { day: dayKey(date), steps: stepsOn(date) };
  });
  const sevenBefore = Array.from({ length: 7 }, (_, i) => stepsOn(daysAgo(i + 1)));

  const weeks = Array.from({ length: STEPS_WEEKS }, (_, weeksAgo): StepsWeek => {
    const { start, end } = weekRange(now, weeksAgo);
    const current = weeksAgo === 0;
    const counted = current ? calendarDaysBetween(start, today) + 1 : 7;
    let total = 0;
    for (let i = 0; i < counted; i++) {
      total += stepsOn(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
    }
    return { start, end, total, dailyAverage: Math.round(total / counted), current };
  });

  return {
    today: stepsOn(today),
    lastSevenDays,
    sevenDayAverage: Math.round(sevenBefore.reduce((sum, n) => sum + n, 0) / 7),
    thisWeek: weeks[0].total,
    weeks,
  };
}

/** "YYYY-MM-DD" in local time, as health/steps.ts keys a day. */
function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Whole calendar days from `from` to `to` (both local midnights) -- right across a clock change. */
function calendarDaysBetween(from: Date, to: Date): number {
  const utc = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}
