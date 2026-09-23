import type { OneRepMax, RepPR } from './prQueries';
import type { CompletedSetRecord } from './workoutQueries';

// The single authoritative place for three small pieces of logic that were
// previously copy-pasted, verbatim, between dashboard/recentWorkoutInfo.ts
// and sharing/shareCardData.ts: which set was heaviest, how long a workout
// took, and whether a given set is CURRENTLY a live PR/1RM. No new PR
// definition -- resolveTopSetPrLabel is the exact same
// read-back-and-compare-source_set_id pattern used everywhere else a set's
// PR status is checked (see prQueries.ts's own comment on why that's the
// only way a PR is ever determined).

/** The heaviest set among already-completed sets, or null if there are none. */
export function heaviestSet(sets: CompletedSetRecord[]): CompletedSetRecord | null {
  return sets.reduce<CompletedSetRecord | null>(
    (max, s) => (!max || s.weightKg > max.weightKg ? s : max),
    null,
  );
}

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
