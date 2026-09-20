// Pure, no I/O -- mirrors greeting.ts's shape (an injectable `now` so this
// is testable without mocking a clock through a screen). The caller is
// responsible for fetching which days had a completed workout (see
// workoutQueries.fetchWorkoutsForDateRange) and passing just the dates in.

export interface WeeklyProgressDay {
  label: string;
  date: Date;
  completed: boolean;
  /**
   * True for a past day (strictly before today, local time) with no
   * completed workout -- shown as a neutral "Rest Day" rather than a
   * "missed" one. Computed on the fly, never persisted: today and any
   * future day in the week are never a rest day, since they haven't
   * concluded yet.
   */
  isRestDay: boolean;
}

export interface WeeklyProgress {
  days: WeeklyProgressDay[];
  completedCount: number;
  /** The user's own workout-frequency-per-week goal (profile.workoutFrequencyDays), or null if never set. */
  goalCount: number | null;
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Monday 00:00 (local time) of the week containing `now`, through the following Monday (exclusive). */
export function getCurrentWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const day = now.getDay(); // 0 = Sunday .. 6 = Saturday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start, end };
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `performedDates` -- one Date per completed workout this week (duplicates on the same day collapse naturally). */
export function computeWeeklyProgress(
  performedDates: Date[],
  goalCount: number | null,
  now: Date = new Date(),
): WeeklyProgress {
  const { start } = getCurrentWeekRange(now);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days: WeeklyProgressDay[] = DAY_LABELS.map((label, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    const completed = performedDates.some((performed) => isSameLocalDay(performed, date));
    const isRestDay = !completed && date.getTime() < today.getTime();
    return { label, date, completed, isRestDay };
  });

  return {
    days,
    completedCount: days.filter((d) => d.completed).length,
    goalCount,
  };
}
