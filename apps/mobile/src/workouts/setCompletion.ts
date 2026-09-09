import type { SetRecord } from './workoutQueries';

// Pure, dependency-free (no supabase import, unlike workoutQueries.ts
// itself) so progressiveOverload.ts and its test can use this without
// pulling in @react-native-async-storage/async-storage under Jest.

export type CompletedSetRecord = SetRecord & { weightKg: number; reps: number };

/**
 * Only sets that have actually been logged (weight + reps entered and
 * marked complete) represent real performance data -- a blank/in-progress
 * set is live-tracking UI state, not yet something PRs, previous-
 * performance, volume, or share cards should ever include.
 */
export function completedSetsOnly(sets: SetRecord[]): CompletedSetRecord[] {
  return sets.filter(
    (s): s is CompletedSetRecord =>
      s.completedAt !== null && s.weightKg !== null && s.reps !== null,
  );
}
