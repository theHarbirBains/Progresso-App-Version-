// Pure, no I/O -- mirrors greeting.ts's shape (an injectable `now` so this
// is testable without mocking a clock through a screen).

/** Monday 00:00 (local time) of the week containing `now`, through the following Monday (exclusive). */
export function getCurrentWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const day = now.getDay(); // 0 = Sunday .. 6 = Saturday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start, end };
}
