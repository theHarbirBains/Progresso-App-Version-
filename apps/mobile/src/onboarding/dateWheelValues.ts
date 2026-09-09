export const MONTH_NAMES = [
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

const MIN_YEAR = 1900;

export function currentMaxYear(now: Date = new Date()): number {
  return now.getFullYear();
}

export function yearRange(now: Date = new Date()): number[] {
  const max = currentMaxYear(now);
  const years: number[] = [];
  for (let y = max; y >= MIN_YEAR; y--) years.push(y);
  return years;
}

export function daysInMonth(monthIndex: number, year: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Clamps a day (e.g. 31) down to the last valid day of the given month/year (e.g. 28 for February). */
export function clampDay(day: number, monthIndex: number, year: number): number {
  return Math.min(day, daysInMonth(monthIndex, year));
}

export function formatMonthDayYear(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** YYYY-MM-DD, matching the API's plain date-string wire format. */
export function toDateStringUTC(monthIndex: number, day: number, year: number): string {
  const mm = String(monthIndex + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}
