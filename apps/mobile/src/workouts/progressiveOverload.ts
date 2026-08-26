import type { SetRecord } from './workoutQueries';

// Deterministic, explainable comparisons only -- no estimated 1RM formulas,
// no automatic prescriptions, no AI. A pure function over data the caller
// already has (the current exercise's logged sets and Phase 3's existing
// "previous performance" sets), comparing canonical kg so lb/kg formatting
// never affects the comparison itself -- only the caller-supplied
// formatWeight touches display units.
export interface ProgressiveOverloadInsight {
  message: string;
}

function heaviestSet(sets: SetRecord[]): SetRecord | null {
  return sets.reduce<SetRecord | null>(
    (max, s) => (!max || s.weightKg > max.weightKg ? s : max),
    null,
  );
}

/**
 * Compares the heaviest set logged so far in this workout against the
 * heaviest set from the previous time this exercise was performed. Only
 * covers the handful of unambiguous, deterministic cases explicitly in
 * scope for Phase 4 (heavier at the same reps, heavier at different reps,
 * same weight for more reps) -- anything else returns null rather than
 * inventing a heuristic.
 */
export function compareToPrevious(
  currentSets: SetRecord[],
  previousSets: SetRecord[],
  formatWeight: (kg: number) => string,
): ProgressiveOverloadInsight | null {
  const currentTop = heaviestSet(currentSets);
  const previousTop = heaviestSet(previousSets);
  if (!currentTop || !previousTop) return null;

  if (currentTop.weightKg > previousTop.weightKg) {
    if (currentTop.reps === previousTop.reps) {
      const deltaKg = currentTop.weightKg - previousTop.weightKg;
      return { message: `+${formatWeight(deltaKg)} at ${currentTop.reps} reps` };
    }
    return {
      message: `Your top set increased from ${formatWeight(previousTop.weightKg)} to ${formatWeight(currentTop.weightKg)}`,
    };
  }

  if (currentTop.weightKg === previousTop.weightKg && currentTop.reps > previousTop.reps) {
    return { message: 'Matched your previous weight for more reps' };
  }

  return null;
}
