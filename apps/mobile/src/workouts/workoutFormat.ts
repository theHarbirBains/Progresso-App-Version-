// Display formatting for a workout's date and duration, shared by the workout
// history list, the profile and a workout's own page. Pure -- no data access.

export function formatCardDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "Jan 1, 2026" -- no weekday. The other common date preset across
 * Progress/live-workout screens (milestones, chart tooltips, previous-
 * session headers, PR history) -- was independently reimplemented with
 * these same three options in each of those files before being
 * consolidated here. */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "Jan 1" -- no weekday, no year. For a PR row, where the exact year is
 * secondary to how recently it was set. */
export function formatMonthDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** "45 min", "1h 5m", or "--" when the duration is unknown. */
export function formatCardDuration(minutes: number | null): string {
  if (minutes === null) return '--';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest} min`;
}
