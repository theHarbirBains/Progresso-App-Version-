import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import {
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  fetchWorkoutHistory,
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

function heaviestSet(sets: SetRecord[]): SetRecord | null {
  return sets.reduce<SetRecord | null>(
    (max, s) => (!max || s.weightKg > max.weightKg ? s : max),
    null,
  );
}

function computeDurationMinutes(performedAt: string, completedAt: string | null): number | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(performedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
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
  let topSet: SetRecord | null = null;
  for (const exercise of detail.exercises) {
    const candidate = heaviestSet(exercise.sets);
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

    if (topSet.reps === 1) {
      if (oneRepMax?.sourceSetId === topSet.id) prLabel = '1RM';
    } else {
      const matching = repPRs.find((pr) => pr.reps === topSet!.reps);
      if (matching?.sourceSetId === topSet.id) prLabel = `${topSet.reps} Rep PR`;
    }

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
