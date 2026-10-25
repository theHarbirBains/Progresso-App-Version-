// Pure, no I/O -- mirrors greeting.ts's shape (an injectable `now` so this
// is testable without mocking a clock through a screen).

/**
 * Sunday 00:00 (local time) of the week containing `now`, through the following Sunday
 * (exclusive): the weekly calorie budget's week, Sunday to Saturday.
 */
export function getCurrentWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  // getDay() is 0 on a Sunday .. 6 on a Saturday: the days since this week's Sunday.
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start, end };
}
