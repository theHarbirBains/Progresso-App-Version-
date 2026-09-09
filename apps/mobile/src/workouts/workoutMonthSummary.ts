import type { EnrichedWorkoutSummary } from './workoutHistoryEnrichment';

export interface MonthSummary {
  totalWorkouts: number;
  totalMinutes: number;
  totalSets: number;
}

/** Pure aggregation over one month's already-fetched, already-enriched workouts -- no query of its own, so switching months never requires a new backend concept, only a new fetch of the same shape. */
export function computeMonthSummary(workouts: EnrichedWorkoutSummary[]): MonthSummary {
  return workouts.reduce<MonthSummary>(
    (acc, workout) => ({
      totalWorkouts: acc.totalWorkouts + 1,
      totalMinutes: acc.totalMinutes + (workout.durationMinutes ?? 0),
      totalSets: acc.totalSets + workout.completedSetCount,
    }),
    { totalWorkouts: 0, totalMinutes: 0, totalSets: 0 },
  );
}

/** "9h 24m" / "45m" -- matches the reference's compact duration format. */
export function formatTotalTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
