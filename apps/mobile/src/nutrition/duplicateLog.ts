// The same food logged twice within a few seconds is almost always a double tap, so the second
// time asks first. Anything further apart is logged without a question.
export const DUPLICATE_WINDOW_MS = 10_000;

/** Whether this food was logged in the last few seconds. */
export function loggedJustNow(
  logs: { foodId: string | null; loggedAt: string }[],
  foodId: string,
  now: number = Date.now(),
): boolean {
  return logs.some(
    (log) =>
      log.foodId === foodId &&
      now - Date.parse(log.loggedAt) >= 0 &&
      now - Date.parse(log.loggedAt) < DUPLICATE_WINDOW_MS,
  );
}
