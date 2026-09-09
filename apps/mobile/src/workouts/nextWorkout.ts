import type { WorkoutSplitDay, WorkoutSplitDetail } from './workoutSplitQueries';

// Pure derivation, no data fetching -- deterministic given the active
// split's ordered days and which day (if any) the user's most recently
// completed workout was tagged with. Never guesses from muscle-group
// overlap: the tag is set explicitly at workout-start time (see
// NewWorkoutScreen), so this is a plain "advance to the next day" cycle.

export interface NextWorkoutPlan {
  splitId: string;
  splitName: string;
  day: WorkoutSplitDay;
  /** Null when there's no relevant prior workout under this split (new split, or the split changed since). */
  previousDayName: string | null;
}

/**
 * - No days in the split -> null (nothing to recommend).
 * - No last-tagged day, or that day no longer belongs to this split (split
 *   was swapped, or the day was deleted) -> day 1, "let's get started".
 * - Otherwise -> the day after the last-tagged one, cycling back to day 1
 *   after the last day.
 */
export function computeNextWorkout(
  split: WorkoutSplitDetail,
  lastCompletedDayId: string | null,
): NextWorkoutPlan | null {
  const ordered = [...split.days].sort((a, b) => a.orderIndex - b.orderIndex);
  if (ordered.length === 0) return null;

  const lastIndex =
    lastCompletedDayId !== null ? ordered.findIndex((d) => d.id === lastCompletedDayId) : -1;

  if (lastIndex === -1) {
    return {
      splitId: split.id,
      splitName: split.name,
      day: ordered[0],
      previousDayName: null,
    };
  }

  const nextIndex = (lastIndex + 1) % ordered.length;
  return {
    splitId: split.id,
    splitName: split.name,
    day: ordered[nextIndex],
    previousDayName: ordered[lastIndex].name,
  };
}
