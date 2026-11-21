import { isoToLocalDateKey } from '../design/calendarGrid';

// Rest days (Harbir's call): a day with no workout logged is a rest day, shown with a moon on
// Workout History's calendar. Only a day that's over -- today can still have its workout -- and
// only from the person's first workout on, so the months before they trained aren't a wall of
// rest. Pure.

/** The day key ("YYYY-MM-DD") of the earliest of these workouts; null with none. */
export function firstWorkoutDayKey(workouts: { performedAt: string }[]): string | null {
  let first: string | null = null;
  for (const workout of workouts) {
    const key = isoToLocalDateKey(workout.performedAt);
    if (first === null || key < first) first = key;
  }
  return first;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * A month's rest days (`month` 1-12): each of its days from `firstKey` up to the day before
 * `todayKey` with no workout in `workoutDayKeys`.
 */
export function restDayKeys(
  year: number,
  month: number,
  workoutDayKeys: Set<string>,
  firstKey: string | null,
  todayKey: string,
): Set<string> {
  const rest = new Set<string>();
  if (firstKey === null) return rest;
  const days = new Date(year, month, 0).getDate();
  for (let day = 1; day <= days; day++) {
    const key = `${year}-${pad(month)}-${pad(day)}`;
    if (key >= firstKey && key < todayKey && !workoutDayKeys.has(key)) rest.add(key);
  }
  return rest;
}
