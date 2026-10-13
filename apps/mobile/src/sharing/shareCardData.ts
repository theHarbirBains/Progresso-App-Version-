import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import {
  computeDurationMinutes,
  heaviestSet,
  resolveTopSetPrLabel,
} from '../workouts/topSetSummary';
import { completedSetsOnly, fetchWorkoutDetail } from '../workouts/workoutQueries';
import { computeLifetimeVolumeKg } from '../progress/lifetimeStats';

// Pure data assembly for the workout share card. Every value here comes from
// an existing query/definition (workoutQueries.ts, prQueries.ts,
// muscleGroups.ts) -- the same top-set (heaviest weightKg) and PR
// (source_set_id match) definitions already used by WorkoutDetailScreen and
// the Dashboard's recentWorkoutInfo.ts. No new PR logic, no estimated 1RM,
// no invented metrics. Rendering (ShareWorkoutScreen.tsx) and native
// capture/share are deliberately kept out of this file.

export interface ShareTopSet {
  exerciseName: string;
  /** The exercise's machine photo, when it has one (most don't -- the card shows its initial instead). */
  photoUrl: string | null;
  weightKg: number;
  reps: number;
  /** "8 Rep PR" / "1RM" when this set is CURRENTLY the live record -- never "estimated". */
  prLabel: string | null;
}

export interface ShareCardData {
  workoutName: string;
  performedAt: string;
  musclesTrained: string;
  durationMinutes: number | null;
  /** Exercises with at least one logged set -- never one that was only planned. */
  exerciseCount: number;
  /** Sets actually logged (completed) -- never planned or blank ones. */
  totalSets: number;
  /** Sum of weight x reps over the logged sets, in canonical kilograms; the card converts it to the user's unit. Never estimated. */
  totalVolumeKg: number;
  /**
   * Every exercise's top set, in the workout's existing order -- never
   * re-sorted by weight. All of them, not just the few the card lists, so the
   * card's personal-record count covers the whole workout.
   */
  topSets: ShareTopSet[];
}

/**
 * Assembles the share card's data. Throws if the workout is not completed --
 * sharing an in-progress workout is never allowed, so there is no
 * "incomplete workout" return shape for callers to accidentally render.
 */
export async function fetchShareCardData(
  workoutId: string,
  userId: string,
): Promise<ShareCardData> {
  const detail = await fetchWorkoutDetail(workoutId);
  if (!detail.completedAt) {
    throw new Error('Only completed workouts can be shared');
  }

  const musclesTrained = Array.from(
    new Set(detail.exercises.map((e) => MUSCLE_GROUP_LABELS[e.muscleGroup])),
  ).join(', ');

  const durationMinutes = computeDurationMinutes(detail.performedAt, detail.completedAt);

  const topSets = (
    await Promise.all(
      detail.exercises.map(async (exercise): Promise<ShareTopSet | null> => {
        const topSet = heaviestSet(completedSetsOnly(exercise.sets));
        if (!topSet) return null;

        const [repPRs, oneRepMax] = await Promise.all([
          fetchRepPRs(userId, exercise.exerciseId),
          fetchOneRepMax(userId, exercise.exerciseId),
        ]);

        const prLabel = resolveTopSetPrLabel(topSet, repPRs, oneRepMax);

        return {
          exerciseName: exercise.exerciseName,
          photoUrl: exercise.photoUrl ?? null,
          weightKg: topSet.weightKg,
          reps: topSet.reps,
          prLabel,
        };
      }),
    )
  ).filter((entry): entry is ShareTopSet => entry !== null);

  const loggedSets = detail.exercises.flatMap((e) => completedSetsOnly(e.sets));
  const exerciseCount = detail.exercises.filter((e) => completedSetsOnly(e.sets).length > 0).length;

  return {
    workoutName: detail.name,
    performedAt: detail.performedAt,
    musclesTrained,
    durationMinutes,
    exerciseCount,
    totalSets: loggedSets.length,
    totalVolumeKg: computeLifetimeVolumeKg(loggedSets),
    topSets,
  };
}
