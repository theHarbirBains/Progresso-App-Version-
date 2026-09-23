// Pure aggregation over already-fetched, real data -- same "no query of its
// own" pattern as lifetimeStats.ts/muscleGroupProgress.ts. Weeks start Monday
// (mirrors dashboard/weeklyProgress.ts's own convention for the current
// week; duplicated here in miniature rather than importing across the
// dashboard/progress folder boundary for 3 lines of date math).

import { setVolumeKg } from '../workouts/workoutSummary';

export interface WeeklyPoint {
  /** ISO string for the Monday 00:00 (local) this bucket covers. */
  weekStart: string;
  value: number;
}

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

function mondayOf(date: Date): Date {
  const day = date.getDay(); // 0 = Sunday .. 6 = Saturday
  const offset = day === 0 ? -6 : 1 - day;
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + offset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Buckets `items` into the last `weeks` Monday-start weeks (oldest first,
 * always including the current week), summing `value(item)` per week an
 * item's `performedAt` falls into. Every week in the window appears even if
 * nothing happened that week (value 0), so a chart never silently skips a
 * quiet week; an item outside the window is simply not counted.
 */
function bucketByWeek<T>(
  items: T[],
  performedAt: (item: T) => string,
  value: (item: T) => number,
  weeks: number,
  now: Date,
): WeeklyPoint[] {
  const thisWeekStart = mondayOf(now).getTime();
  const bucketStarts = Array.from(
    { length: weeks },
    (_, i) => thisWeekStart - (weeks - 1 - i) * MS_PER_WEEK,
  );
  const sums = new Map<number, number>(bucketStarts.map((t) => [t, 0]));

  for (const item of items) {
    const itemWeekStart = mondayOf(new Date(performedAt(item))).getTime();
    if (sums.has(itemWeekStart)) {
      sums.set(itemWeekStart, sums.get(itemWeekStart)! + value(item));
    }
  }

  return bucketStarts.map((t) => ({ weekStart: new Date(t).toISOString(), value: sums.get(t)! }));
}

/** One point per week: how many workouts were performed that week. */
export function computeWeeklyWorkoutCounts(
  workouts: { performedAt: string }[],
  weeks = 8,
  now: Date = new Date(),
): WeeklyPoint[] {
  return bucketByWeek(
    workouts,
    (w) => w.performedAt,
    () => 1,
    weeks,
    now,
  );
}

/**
 * One point per week: total training volume (kg) that week -- same weight x
 * reps definition as lifetimeStats.ts's computeLifetimeVolumeKg, just
 * bucketed by week instead of summed once.
 */
export function computeWeeklyVolumeKg(
  sets: { performedAt: string; weightKg: number; reps: number }[],
  weeks = 8,
  now: Date = new Date(),
): WeeklyPoint[] {
  return bucketByWeek(sets, (s) => s.performedAt, setVolumeKg, weeks, now);
}

/** One point per week: how many completed sets were logged that week. */
export function computeWeeklySetCounts(
  sets: { performedAt: string }[],
  weeks = 8,
  now: Date = new Date(),
): WeeklyPoint[] {
  return bucketByWeek(
    sets,
    (s) => s.performedAt,
    () => 1,
    weeks,
    now,
  );
}
