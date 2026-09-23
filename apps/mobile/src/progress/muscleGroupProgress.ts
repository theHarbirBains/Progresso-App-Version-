import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import type { HistoricalSetWithExercise } from '../workouts/exerciseHistoryGrouping';
import { setVolumeKg } from '../workouts/workoutSummary';

// Each exercise already declares which single muscle group it trains
// (exercises.muscle_group, required for both built-in and custom exercises --
// see 20260823100004_exercises.sql). A completed set's training exposure is
// attributed to that exercise's own muscle group, never to a workout's split
// day: a set is real exposure for the muscle it actually trains regardless of
// what else that day's split happened to be tagged with.

export interface MuscleGroupSetCount {
  group: MuscleGroup;
  label: string;
  count: number;
}

/** Real completed-set counts per muscle group, most-trained first. Only groups with at least one completed set are included -- never a zero-filled placeholder row. */
export function computeMuscleGroupSetCounts(
  history: HistoricalSetWithExercise[],
): MuscleGroupSetCount[] {
  const counts = new Map<MuscleGroup, number>();
  for (const set of history) {
    counts.set(set.muscleGroup, (counts.get(set.muscleGroup) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([group, count]) => ({ group, label: MUSCLE_GROUP_LABELS[group], count }))
    .sort((a, b) => b.count - a.count);
}

export interface MuscleGroupVolume {
  group: MuscleGroup;
  label: string;
  volumeKg: number;
}

/** Real lifetime training volume (weight x reps, summed) per muscle group, heaviest first -- same attribution rule as computeMuscleGroupSetCounts (a set's own exercise.muscle_group), just volume instead of a set count. Only groups with at least one completed set are included. */
export function computeMuscleGroupVolumeKg(
  history: HistoricalSetWithExercise[],
): MuscleGroupVolume[] {
  const totals = new Map<MuscleGroup, number>();
  for (const set of history) {
    totals.set(set.muscleGroup, (totals.get(set.muscleGroup) ?? 0) + setVolumeKg(set));
  }
  return Array.from(totals.entries())
    .map(([group, volumeKg]) => ({ group, label: MUSCLE_GROUP_LABELS[group], volumeKg }))
    .sort((a, b) => b.volumeKg - a.volumeKg);
}
