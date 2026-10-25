// The same food logged twice within a few seconds is almost always a double tap, so the second
// time asks first. Anything further apart is logged without a question.
export const DUPLICATE_WINDOW_MS = 10_000;

/**
 * Whether this food was logged in the last few seconds -- the same food, or one of the same name:
 * a searched food is logged through its Food Library copy, so the log points at the copy.
 */
export function loggedJustNow(
  logs: { foodId: string | null; foodNameSnapshot?: string; loggedAt: string }[],
  foodId: string,
  now: number = Date.now(),
  foodName?: string,
): boolean {
  const name = foodName?.trim().toLowerCase();
  return logs.some(
    (log) =>
      (log.foodId === foodId ||
        (name !== undefined && log.foodNameSnapshot?.trim().toLowerCase() === name)) &&
      now - Date.parse(log.loggedAt) >= 0 &&
      now - Date.parse(log.loggedAt) < DUPLICATE_WINDOW_MS,
  );
}
