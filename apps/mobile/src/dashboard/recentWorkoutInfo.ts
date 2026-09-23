import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import { computeDurationMinutes, heaviestSet, resolveTopSetPrLabel } from '../workouts/topSetSummary';
import {
  completedSetsOnly,
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  fetchWorkoutHistory,
  type CompletedSetRecord,
  type SetRecord,
  type WorkoutSummary,
} from '../workouts/workoutQueries';

// Orchestration only -- every read here is an existing query function
// (workoutQueries.ts, prQueries.ts), and the PR/1RM check is the same
// read-back-and-compare-source_set_id pattern already used by
// ActiveWorkoutScreen/WorkoutDetailScreen. No new Supabase queries, no new
// PR definition, no estimated 1RM. Unit formatting is deliberately left to
// the caller (raw kg in, raw kg out) so this has no dependency on the
// user's profile having loaded yet.

export interface RecentWorkoutInfo {
  workout: WorkoutSummary;
  musclesTrained: string;
  durationMinutes: number | null;
  topExerciseName: string | null;
  /** All sets logged for the top-set exercise in this workout -- feeds compareToPrevious. */
  topExerciseSets: SetRecord[];
  /** All sets from the previous occurrence of that exercise, or [] if none. */
  previousExerciseSets: SetRecord[];
  topSet: SetRecord | null;
  /** "8 Rep PR" / "1RM" when the top set is CURRENTLY the record -- never "estimated". */
  prLabel: string | null;
}

/**
 * Assembles the Dashboard's Recent Workout card. Returns null when the
 * user has no completed workout yet (a real empty state, not an error).
 */
export async function fetchRecentWorkoutInfo(userId: string): Promise<RecentWorkoutInfo | null> {
  const history = await fetchWorkoutHistory(userId, 0, 1);
  const summary = history.rows[0];
  if (!summary) return null;

  const detail = await fetchWorkoutDetail(summary.id);

  let topExerciseId: string | null = null;
  let topExerciseName: string | null = null;
  let topSet: CompletedSetRecord | null = null;
  for (const exercise of detail.exercises) {
    const candidate = heaviestSet(completedSetsOnly(exercise.sets));
    if (candidate && (!topSet || candidate.weightKg > topSet.weightKg)) {
      topSet = candidate;
      topExerciseId = exercise.exerciseId;
      topExerciseName = exercise.exerciseName;
    }
  }

  const musclesTrained = Array.from(
    new Set(detail.exercises.map((e) => MUSCLE_GROUP_LABELS[e.muscleGroup])),
  ).join(', ');

  const durationMinutes = computeDurationMinutes(detail.performedAt, detail.completedAt);

  let prLabel: string | null = null;
  let topExerciseSets: SetRecord[] = [];
  let previousExerciseSets: SetRecord[] = [];

  if (topExerciseId && topSet) {
    topExerciseSets = detail.exercises.find((e) => e.exerciseId === topExerciseId)?.sets ?? [];

    const [repPRs, oneRepMax, previous] = await Promise.all([
      fetchRepPRs(userId, topExerciseId),
      fetchOneRepMax(userId, topExerciseId),
      fetchPreviousPerformance(userId, topExerciseId, summary.id),
    ]);

    prLabel = resolveTopSetPrLabel(topSet, repPRs, oneRepMax);

    if (previous) previousExerciseSets = previous.sets;
  }

  return {
    workout: summary,
    musclesTrained,
    durationMinutes,
    topExerciseName,
    topExerciseSets,
    previousExerciseSets,
    topSet,
    prLabel,
  };
}
