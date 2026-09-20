import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';

export interface PRFeedRow {
  key: string;
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  /** null for a true-1RM record (a 1RM isn't described by a rep count the way a rep-count PR is). */
  reps: number | null;
  achievedAt: string;
  /** "1RM" or "N-Rep PR" -- the record-type distinction the spec asks for, exactly as the data supports it. */
  recordType: string;
  sourceSetId: string;
}

/**
 * Every personal record Progresso currently tracks -- rep-count PRs and
 * true 1RMs (both database-maintained, see prSummaryQueries.ts) -- merged
 * into one feed, most recent first. The single shared derivation behind
 * both PRsSection (the full list) and OverviewSection's "Recent
 * Milestones" (the newest few), so the merge/sort logic exists in exactly
 * one place.
 */
export function mergeAndSortPRs(
  repPRs: RepPRWithExercise[],
  oneRepMaxes: OneRepMaxWithExercise[],
): PRFeedRow[] {
  const fromPRs: PRFeedRow[] = repPRs.map((pr) => ({
    key: `pr-${pr.exerciseId}-${pr.reps}`,
    exerciseId: pr.exerciseId,
    exerciseName: pr.exerciseName,
    weightKg: pr.bestWeightKg,
    reps: pr.reps,
    achievedAt: pr.achievedAt,
    recordType: `${pr.reps}-Rep PR`,
    sourceSetId: pr.sourceSetId,
  }));
  const fromOrms: PRFeedRow[] = oneRepMaxes.map((orm) => ({
    key: `orm-${orm.exerciseId}`,
    exerciseId: orm.exerciseId,
    exerciseName: orm.exerciseName,
    weightKg: orm.weightKg,
    reps: null,
    achievedAt: orm.achievedAt,
    recordType: '1RM',
    sourceSetId: orm.sourceSetId,
  }));
  return [...fromPRs, ...fromOrms].sort(
    (a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime(),
  );
}
