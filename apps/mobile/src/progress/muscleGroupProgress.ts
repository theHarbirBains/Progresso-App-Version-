import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import type { HistoricalSetWithExercise } from '../workouts/exerciseHistoryGrouping';
import type { SplitMuscleGroup } from '../workouts/splitMuscleGroups';

// Each exercise already declares which single muscle group it trains
// (exercises.muscle_group, required for both built-in and custom exercises --
// see 20260823100004_exercises.sql). A completed set's training exposure is
// attributed to that exercise's own muscle group, never to a workout's split
// day: a set is real exposure for the muscle it actually trains regardless of
// what else that day's split happened to be tagged with.

/**
 * Maps the exercise-level muscle_group vocabulary (13 values, includes
 * full_body/other) onto the coarser split-day vocabulary MuscleVisualization
 * already knows how to highlight (11 values). full_body/other have no single
 * anatomical region to highlight, so they map to null -- still counted and
 * listed, just not drawn on the body figure.
 */
const TO_SPLIT_GROUP: Record<MuscleGroup, SplitMuscleGroup | null> = {
  chest: 'chest',
  back: 'back',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  quadriceps: 'quads',
  hamstrings: 'hamstrings',
  glutes: 'glutes',
  calves: 'calves',
  core: 'abs',
  full_body: null,
  other: null,
};

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

/** The distinct anatomical regions to highlight on MuscleVisualization -- every trained group that maps to one, deduplicated. */
export function muscleGroupsForVisualization(counts: MuscleGroupSetCount[]): SplitMuscleGroup[] {
  const mapped = counts
    .map((c) => TO_SPLIT_GROUP[c.group])
    .filter((g): g is SplitMuscleGroup => g !== null);
  return Array.from(new Set(mapped));
}
