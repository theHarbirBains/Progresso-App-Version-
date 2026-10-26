import { measurementTypeOf, type MeasurementType } from '../exercises/movementTypes';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import {
  fetchDurationRecord,
  fetchOneRepMax,
  fetchRepPRs,
  fetchRepRecord,
} from '../workouts/prQueries';
import { bestLoggedSet, loggedSets, setValuesOf } from '../workouts/setValues';
import { computeDurationMinutes, resolveTopSetPrLabel } from '../workouts/topSetSummary';
import {
  completedSetsOnly,
  fetchWorkoutDetail,
  type CompletedSetRecord,
} from '../workouts/workoutQueries';
import { computeLifetimeVolumeKg } from '../progress/lifetimeStats';

// Pure data assembly for the workout share card. Every value here comes from
// an existing query/definition (workoutQueries.ts, prQueries.ts,
// muscleGroups.ts) -- the same top-set (heaviest weightKg) and PR
// (source_set_id match) definitions already used by WorkoutDetailScreen
// (workouts/topSetSummary.ts). No new PR logic, no estimated 1RM,
// no invented metrics. Rendering (ShareWorkoutScreen.tsx) and native
// capture/share are deliberately kept out of this file.

export interface ShareTopSet {
  exerciseName: string;
  /** The exercise's machine photo, when it has one (most don't -- the card shows its initial instead). */
  photoUrl: string | null;
  /** What the exercise was logged as: its best set is the heaviest, the most reps, or the longest. */
  measurementType: MeasurementType;
  /** Weight and reps only. */
  weightKg: number | null;
  /** Null for a timed exercise. */
  reps: number | null;
  /** A timed exercise's longest set, in seconds. */
  durationSeconds: number | null;
  /** "8 Rep PR" / "1RM" (or "PR" for a bodyweight or timed record) when this set is CURRENTLY the live record -- never "estimated". */
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
  /** Sum of weight x reps over the logged sets of weighted exercises, in canonical kilograms; the card converts it to the user's unit. Never estimated. */
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
        const type = measurementTypeOf(exercise);
        const topSet = bestLoggedSet(exercise.sets, type);
        if (!topSet) return null;

        let prLabel: string | null;
        if (type === 'weight_reps') {
          const [repPRs, oneRepMax] = await Promise.all([
            fetchRepPRs(userId, exercise.exerciseId),
            fetchOneRepMax(userId, exercise.exerciseId),
          ]);
          prLabel = resolveTopSetPrLabel(topSet as CompletedSetRecord, repPRs, oneRepMax);
        } else {
          // A bodyweight or timed exercise's record: the most reps, the longest time.
          const record =
            type === 'timed'
              ? await fetchDurationRecord(userId, exercise.exerciseId)
              : await fetchRepRecord(userId, exercise.exerciseId);
          prLabel = record?.sourceSetId === topSet.id ? 'PR' : null;
        }

        const { weightKg, reps, durationSeconds } = setValuesOf(topSet, type);
        return {
          exerciseName: exercise.exerciseName,
          photoUrl: exercise.photoUrl ?? null,
          measurementType: type,
          weightKg,
          reps,
          durationSeconds,
          prLabel,
        };
      }),
    )
  ).filter((entry): entry is ShareTopSet => entry !== null);

  const logged = detail.exercises.map((e) => loggedSets(e.sets, measurementTypeOf(e)));
  const exerciseCount = logged.filter((sets) => sets.length > 0).length;
  // Volume is weight x reps: weighted exercises only.
  const weightedSets = detail.exercises
    .filter((e) => measurementTypeOf(e) === 'weight_reps')
    .flatMap((e) => completedSetsOnly(e.sets));

  return {
    workoutName: detail.name,
    performedAt: detail.performedAt,
    musclesTrained,
    durationMinutes,
    exerciseCount,
    totalSets: logged.reduce((sum, sets) => sum + sets.length, 0),
    totalVolumeKg: computeLifetimeVolumeKg(weightedSets),
    topSets,
  };
}
