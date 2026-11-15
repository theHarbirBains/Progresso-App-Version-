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

export function yearRange(now: Date = new Date(), max: number = currentMaxYear(now)): number[] {
  const years: number[] = [];
  for (let y = max; y >= MIN_YEAR; y--) years.push(y);
  return years;
}

/** A date as the wheels hold it: month 0-11. */
export interface WheelDate {
  month: number;
  day: number;
  year: number;
}

/** The latest birthday of someone `years` old today -- the same day `years` years ago (Feb 29
 * becomes Feb 28 in a year without one). */
export function latestBirthday(years: number, now: Date = new Date()): WheelDate {
  const year = now.getFullYear() - years;
  const month = now.getMonth();
  return { month, day: clampDay(now.getDate(), month, year), year };
}

/** The date, or `latest` when it's later than that -- the wheels never go past it. */
export function clampToLatest(date: WheelDate, latest: WheelDate | undefined): WheelDate {
  if (!latest) return date;
  const after =
    date.year > latest.year ||
    (date.year === latest.year &&
      (date.month > latest.month || (date.month === latest.month && date.day > latest.day)));
  return after ? latest : date;
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
