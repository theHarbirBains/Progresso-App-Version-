import type { SetRecord } from './workoutQueries';

// Pure, dependency-free (no supabase import, unlike workoutQueries.ts
// itself) so callers like recentWorkoutTopSets.ts/workoutSummary.ts and
// their own tests can use this without pulling in
// @react-native-async-storage/async-storage under Jest.

export type CompletedSetRecord = SetRecord & { weightKg: number; reps: number };

/**
 * Only sets that have actually been logged (weight + reps entered and
 * marked complete) represent real performance data -- a blank/in-progress
 * set is live-tracking UI state, not yet something volume or share cards
 * should ever include. Its drop sets are kept: their weight x reps is part of
 * the set's volume (loggedSets is what leaves them out of counts and records).
 */
export function completedSetsOnly(sets: SetRecord[]): CompletedSetRecord[] {
  // A warm-up is real, but counted toward nothing.
  return sets.filter(
    (s): s is CompletedSetRecord =>
      s.completedAt !== null && s.weightKg !== null && s.reps !== null && !s.isWarmup,
  );
}
