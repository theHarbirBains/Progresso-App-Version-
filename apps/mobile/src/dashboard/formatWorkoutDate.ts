// The one date format Dashboard uses for a workout ("Fri, Sep 18") -- shared by
// the Recent Workout card and the Last Workout stat so the same workout never
// shows two different date styles. Locale-aware: month/weekday names follow the
// device's language.
export function formatWorkoutDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
