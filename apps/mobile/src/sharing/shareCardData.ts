import {
  CARDIO_INFO,
  cardioDetails,
  cardioName,
  type CardioActivity,
} from '../cardio/cardioActivities';
import { measurementTypeOf, type MeasurementType } from '../exercises/movementTypes';
import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import {
  fetchDurationRecord,
  fetchOneRepMax,
  fetchRepPRs,
  fetchRepRecord,
} from '../workouts/prQueries';
import { bestLoggedSet, loggedSets, setValuesOf } from '../workouts/setValues';
import {
  computeDurationMinutes,
  isLiveRecord,
  resolveTopSetPrLabel,
  type ExerciseRecords,
} from '../workouts/topSetSummary';
import {
  completedSetsOnly,
  fetchWorkoutDetail,
  type CompletedSetRecord,
} from '../workouts/workoutQueries';
import { computeLifetimeVolumeKg } from '../progress/lifetimeStats';
import { shareDisplayNames, shareTitle } from './shareNames';

// Pure data assembly for the workout share card. Every value here comes from
// an existing query/definition (workoutQueries.ts, prQueries.ts,
// muscleGroups.ts) -- the same top-set (bestLoggedSet), record (isLiveRecord,
// source_set_id match) and duration definitions WorkoutDetailScreen uses
// (workouts/topSetSummary.ts). No new PR logic, no estimated 1RM, no invented
// metrics. Rendering (ShareCard.tsx) and native capture/share
// (ShareWorkoutScreen.tsx) are deliberately kept out of this file.

export interface ShareTopSet {
  exerciseName: string;
  /** The name as the card shows it (sharing/shareNames.ts): never stored, never ambiguous. */
  displayName: string;
  /** "Top Set" for a weighted exercise, "Best Set" for a bodyweight one, "Longest" for a timed one. */
  label: string;
  /** The exercise's machine photo, when it has one. */
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

/** One cardio activity as the card draws it: its glyph, its name and its figures. */
export interface ShareCardio {
  activity: CardioActivity;
  icon: (typeof CARDIO_INFO)[CardioActivity]['icon'];
  name: string;
  /** "15 min · 3 km · Speed 6.5 · 5% incline" -- only what was saved, km for everyone, never calories. */
  figures: string;
  durationSeconds: number;
}

export interface ShareCardData {
  /** The workout's own name, as stored. */
  workoutName: string;
  /** What the card is headed with: the workout's name, or what it trained when it has none. */
  title: string;
  performedAt: string;
  musclesTrained: string;
  /**
   * The workout's whole duration in minutes -- start to finish, so the cardio done in it is in it
   * once -- or null when none was logged.
   */
  durationMinutes: number | null;
  /** Every cardio activity, in the order it was done. Empty without cardio. */
  cardio: ShareCardio[];
  /** All the cardio's time, in seconds. */
  cardioSeconds: number;
  /** Exercises with at least one logged set -- never one that was only planned. */
  exerciseCount: number;
  /** Sets actually logged (completed) -- never planned or blank ones, warm-ups or drops. */
  totalSets: number;
  /** Sum of weight x reps over the logged sets of weighted exercises, in canonical kilograms; the card converts it to the user's unit. Never estimated. */
  totalVolumeKg: number;
  /** How many of its logged sets are CURRENTLY records -- as its own page counts them. */
  recordCount: number;
  /** Every exercise's top set, in the order the workout did them. */
  topSets: ShareTopSet[];
}

/** An exercise's live records: rep PRs and the 1RM for a weighted one, else its most reps or longest. */
async function recordsFor(
  userId: string,
  exerciseId: string,
  type: MeasurementType,
): Promise<ExerciseRecords> {
  if (type === 'weight_reps') {
    const [repPRs, oneRepMax] = await Promise.all([
      fetchRepPRs(userId, exerciseId),
      fetchOneRepMax(userId, exerciseId),
    ]);
    return { repPRs, oneRepMax, record: null };
  }
  const record =
    type === 'timed'
      ? await fetchDurationRecord(userId, exerciseId)
      : await fetchRepRecord(userId, exerciseId);
  return { repPRs: [], oneRepMax: null, record };
}

const TOP_SET_LABELS: Record<MeasurementType, string> = {
  weight_reps: 'Top Set',
  bodyweight: 'Best Set',
  timed: 'Longest',
};

/**
 * Assembles the share card's data. Throws if the workout is not completed --
 * sharing an in-progress workout is never allowed, so there is no
 * "incomplete workout" return shape for callers to accidentally render. Only
 * the workout's own exercises and sets: in a group, the person's own workout.
 */
export async function fetchShareCardData(
  workoutId: string,
  userId: string,
): Promise<ShareCardData> {
  const detail = await fetchWorkoutDetail(workoutId);
  if (!detail.completedAt) {
    throw new Error('Only completed workouts can be shared');
  }

  const muscles = Array.from(
    new Set(detail.exercises.map((e) => MUSCLE_GROUP_LABELS[e.muscleGroup])),
  );

  const done = (
    await Promise.all(
      detail.exercises.map(async (exercise) => {
        const type = measurementTypeOf(exercise);
        const topSet = bestLoggedSet(exercise.sets, type);
        if (!topSet) return null;
        const records = await recordsFor(userId, exercise.exerciseId, type);
        const prLabel =
          type === 'weight_reps'
            ? resolveTopSetPrLabel(topSet as CompletedSetRecord, records.repPRs, records.oneRepMax)
            : records.record?.sourceSetId === topSet.id
              ? 'PR'
              : null;
        const recordSets = loggedSets(exercise.sets, type).filter((set) =>
          isLiveRecord(set, type, records),
        ).length;
        return { exercise, type, topSet, prLabel, recordSets };
      }),
    )
  ).filter((entry) => entry !== null);

  const displayNames = shareDisplayNames(done.map(({ exercise }) => exercise.exerciseName));
  const topSets: ShareTopSet[] = done.map(({ exercise, type, topSet, prLabel }, index) => {
    const { weightKg, reps, durationSeconds } = setValuesOf(topSet, type);
    return {
      exerciseName: exercise.exerciseName,
      displayName: displayNames[index],
      label: TOP_SET_LABELS[type],
      photoUrl: exercise.photoUrl ?? null,
      measurementType: type,
      weightKg,
      reps,
      durationSeconds,
      prLabel,
    };
  });

  const logged = detail.exercises.map((e) => loggedSets(e.sets, measurementTypeOf(e)));
  const cardioEntries = detail.cardio ?? [];
  // Volume is weight x reps: weighted exercises only, drop sets included.
  const weightedSets = detail.exercises
    .filter((e) => measurementTypeOf(e) === 'weight_reps')
    .flatMap((e) => completedSetsOnly(e.sets));

  return {
    workoutName: detail.name,
    title: shareTitle(detail.name, muscles, cardioEntries.length > 0),
    performedAt: detail.performedAt,
    musclesTrained: muscles.join(', '),
    durationMinutes: computeDurationMinutes(detail.performedAt, detail.completedAt),
    cardio: cardioEntries.map((entry) => ({
      activity: entry.activity,
      icon: CARDIO_INFO[entry.activity].icon,
      name: cardioName(entry),
      figures: cardioDetails(entry),
      durationSeconds: entry.durationSeconds,
    })),
    cardioSeconds: cardioEntries.reduce((sum, entry) => sum + entry.durationSeconds, 0),
    exerciseCount: logged.filter((sets) => sets.length > 0).length,
    totalSets: logged.reduce((sum, sets) => sum + sets.length, 0),
    totalVolumeKg: computeLifetimeVolumeKg(weightedSets),
    recordCount: done.reduce((sum, entry) => sum + entry.recordSets, 0),
    topSets,
  };
}
