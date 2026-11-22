import type { MeasurementType } from '../exercises/movementTypes';
import type { ExerciseRecord, OneRepMax, RepPR } from './prQueries';
import type { CompletedSetRecord } from './workoutQueries';

// The single authoritative place for two small pieces of logic shared by the
// workout pages, history and the share card: how long a workout took, and
// whether a given set is CURRENTLY a live PR/1RM. No new PR
// definition -- resolveTopSetPrLabel is the exact same
// read-back-and-compare-source_set_id pattern used everywhere else a set's
// PR status is checked (see prQueries.ts's own comment on why that's the
// only way a PR is ever determined).

/** Minutes between performed_at and completed_at, or null while still in progress (or if the timestamps are somehow non-positive/invalid). */
export function computeDurationMinutes(
  performedAt: string,
  completedAt: string | null,
): number | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(performedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

/**
 * "8 Rep PR" / "1RM" when `topSet` is CURRENTLY that record, else null --
 * never "estimated". A 1-rep set only ever checks the true 1RM table; any
 * other rep count only ever checks the matching rep-count PR.
 */
export function resolveTopSetPrLabel(
  topSet: Pick<CompletedSetRecord, 'id' | 'reps'>,
  repPRs: RepPR[],
  oneRepMax: OneRepMax | null,
): string | null {
  if (topSet.reps === 1) {
    return oneRepMax?.sourceSetId === topSet.id ? '1RM' : null;
  }
  const matching = repPRs.find((pr) => pr.reps === topSet.reps);
  return matching?.sourceSetId === topSet.id ? `${topSet.reps} Rep PR` : null;
}

/** An exercise's live records, as read back for a workout (prQueries.ts). */
export interface ExerciseRecords {
  /** Its rep-count PRs (a weighted exercise). */
  repPRs: RepPR[];
  /** Its true 1RM (a weighted exercise). */
  oneRepMax: OneRepMax | null;
  /** Its most reps or longest time (a bodyweight or timed exercise). */
  record: ExerciseRecord | null;
}

/**
 * Whether a logged set is CURRENTLY one of the person's records: for a weighted exercise its rep
 * count's PR or the true 1RM, otherwise the most reps or the longest -- the same source-set check
 * as resolveTopSetPrLabel. Workout Detail's record tags and the share card's Records both count
 * these.
 */
export function isLiveRecord(
  set: { id: string; reps: number | null },
  type: MeasurementType,
  records: ExerciseRecords,
): boolean {
  if (type !== 'weight_reps') return records.record?.sourceSetId === set.id;
  return (
    records.repPRs.some((pr) => pr.reps === set.reps && pr.sourceSetId === set.id) ||
    records.oneRepMax?.sourceSetId === set.id
  );
}
