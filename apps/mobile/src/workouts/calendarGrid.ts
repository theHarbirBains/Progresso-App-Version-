// Pure date-grid/local-date-key helpers for the Workouts tab's calendar --
// no supabase import, fully unit-testable without mocking anything.

export interface CalendarDay {
  /** "YYYY-MM-DD" in local time -- the key used to look up completed-workout dots and selection state. */
  dateKey: string;
  day: number;
  inCurrentMonth: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "YYYY-MM-DD" in the device's own local time, matching how the calendar's own grid is built -- never toISOString(), which is UTC. */
export function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isoToLocalDateKey(iso: string): string {
  return toLocalDateKey(new Date(iso));
}

/**
 * A 7-column grid covering the given local calendar month (1-indexed),
 * padded with the trailing days of the previous month and leading days of
 * the next month so every week row is complete -- exactly the "31 shown
 * grayed out before September 1" treatment from the reference design.
 */
export function buildMonthGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const leadingCount = firstOfMonth.getDay(); // Sunday = 0, matching the reference's Sun-first week

  const days: CalendarDay[] = [];

  for (let i = leadingCount; i > 0; i--) {
    const date = new Date(year, month - 1, 1 - i);
    days.push({ dateKey: toLocalDateKey(date), day: date.getDate(), inCurrentMonth: false });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    days.push({ dateKey: toLocalDateKey(date), day: d, inCurrentMonth: true });
  }

  const trailingCount = (7 - (days.length % 7)) % 7;
  for (let d = 1; d <= trailingCount; d++) {
    const date = new Date(year, month, d);
    days.push({ dateKey: toLocalDateKey(date), day: date.getDate(), inCurrentMonth: false });
  }

  return days;
}

export function addMonths(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const date = new Date(year, month - 1 + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

export const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
