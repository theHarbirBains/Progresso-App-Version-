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

/** "45 min", "1h 5m", or "--" when the duration is unknown. */
export function formatCardDuration(minutes: number | null): string {
  if (minutes === null) return '--';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours > 0 ? `${hours}h ${rest}m` : `${rest} min`;
}
