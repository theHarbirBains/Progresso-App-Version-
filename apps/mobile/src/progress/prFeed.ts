import type { MeasurementType } from '../exercises/movementTypes';
import { formatSetValues } from '../workouts/setValues';
import type {
  ExerciseRecordWithExercise,
  OneRepMaxWithExercise,
  RepPRWithExercise,
} from '../workouts/prSummaryQueries';

export interface PRFeedRow {
  key: string;
  exerciseId: string;
  exerciseName: string;
  /** The exercise's machine photo, when it has one (most custom ones do; most built-ins don't). */
  photoUrl: string | null;
  /** What the record measures: a weight (a rep PR or 1RM), the most reps, or the longest time. */
  measurementType: MeasurementType;
  /** Null for a bodyweight or timed record. */
  weightKg: number | null;
  /** null for a true-1RM record (a 1RM isn't described by a rep count the way a rep-count PR is), and for a timed one. */
  reps: number | null;
  /** A timed record's time, in seconds. */
  durationSeconds: number | null;
  achievedAt: string;
  /** "1RM", "N-Rep PR", "Most Reps" or "Longest" -- the record-type distinction the spec asks for, exactly as the data supports it. */
  recordType: string;
  sourceSetId: string;
}

/**
 * Every personal record Progresso currently tracks -- rep-count PRs, true
 * 1RMs, and a bodyweight or timed exercise's most reps or longest time (all
 * database-maintained, see prSummaryQueries.ts) -- merged into one feed,
 * most recent first. The single shared derivation behind both PRsSection
 * (the full list) and OverviewSection's "Recent Milestones" (the newest
 * few), so the merge/sort logic exists in exactly one place.
 */
export function mergeAndSortPRs(
  repPRs: RepPRWithExercise[],
  oneRepMaxes: OneRepMaxWithExercise[],
  exerciseRecords: ExerciseRecordWithExercise[] = [],
): PRFeedRow[] {
  const fromPRs: PRFeedRow[] = repPRs.map((pr) => ({
    key: `pr-${pr.exerciseId}-${pr.reps}`,
    exerciseId: pr.exerciseId,
    exerciseName: pr.exerciseName,
    photoUrl: pr.exercisePhotoUrl ?? null,
    measurementType: 'weight_reps',
    weightKg: pr.bestWeightKg,
    reps: pr.reps,
    durationSeconds: null,
    achievedAt: pr.achievedAt,
    recordType: `${pr.reps}-Rep PR`,
    sourceSetId: pr.sourceSetId,
  }));
  const fromOrms: PRFeedRow[] = oneRepMaxes.map((orm) => ({
    key: `orm-${orm.exerciseId}`,
    exerciseId: orm.exerciseId,
    exerciseName: orm.exerciseName,
    photoUrl: orm.exercisePhotoUrl ?? null,
    measurementType: 'weight_reps',
    weightKg: orm.weightKg,
    reps: null,
    durationSeconds: null,
    achievedAt: orm.achievedAt,
    recordType: '1RM',
    sourceSetId: orm.sourceSetId,
  }));
  const fromRecords: PRFeedRow[] = exerciseRecords.map((record) => ({
    key: `record-${record.exerciseId}`,
    exerciseId: record.exerciseId,
    exerciseName: record.exerciseName,
    photoUrl: record.exercisePhotoUrl ?? null,
    measurementType: record.measurementType,
    weightKg: null,
    reps: record.measurementType === 'bodyweight' ? record.value : null,
    durationSeconds: record.measurementType === 'timed' ? record.value : null,
    achievedAt: record.achievedAt,
    recordType: record.measurementType === 'timed' ? 'Longest' : 'Most Reps',
    sourceSetId: record.sourceSetId,
  }));
  return [...fromPRs, ...fromOrms, ...fromRecords].sort(
    (a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime(),
  );
}

/** A bodyweight or timed record's value as PRRow shows it ("25 reps", "1:30"); undefined for a weight. */
export function recordValueText(row: PRFeedRow, unit: 'kg' | 'lb'): string | undefined {
  return row.measurementType === 'weight_reps' ? undefined : formatSetValues(row, unit);
}
