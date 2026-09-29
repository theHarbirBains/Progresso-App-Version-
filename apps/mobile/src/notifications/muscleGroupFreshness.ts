import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import type { HistoricalSetWithExercise } from '../workouts/exerciseHistoryGrouping';

export interface StaleMuscleGroup {
  muscleGroup: MuscleGroup;
  label: string;
  lastTrainedAt: string;
  daysSince: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Muscle groups the user has trained before but not recently -- the
 * notifications bell's "Insights" section. Same attribution rule as
 * muscleGroupProgress.ts (a set's own exercise.muscle_group, never a split
 * day's tag): `history` is the same fetchAllExerciseHistory() data Progress's
 * own Muscle Group view already fetches, so this needs no new query.
 *
 * Deliberately excludes a muscle group with zero history: never training
 * calves isn't "staleness", it's just not part of this user's routine, and
 * flagging it would be noise, not a real reminder.
 */
export function computeStaleMuscleGroups(
  history: HistoricalSetWithExercise[],
  now: Date = new Date(),
  thresholdDays = 7,
): StaleMuscleGroup[] {
  const lastTrainedAt = new Map<MuscleGroup, string>();
  for (const set of history) {
    const existing = lastTrainedAt.get(set.muscleGroup);
    if (!existing || new Date(set.performedAt).getTime() > new Date(existing).getTime()) {
      lastTrainedAt.set(set.muscleGroup, set.performedAt);
    }
  }

  const stale: StaleMuscleGroup[] = [];
  for (const [muscleGroup, lastAt] of lastTrainedAt) {
    const daysSince = Math.floor((now.getTime() - new Date(lastAt).getTime()) / MS_PER_DAY);
    if (daysSince >= thresholdDays) {
      stale.push({ muscleGroup, label: MUSCLE_GROUP_LABELS[muscleGroup], lastTrainedAt: lastAt, daysSince });
    }
  }

  return stale.sort((a, b) => b.daysSince - a.daysSince);
}
