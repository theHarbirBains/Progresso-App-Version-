import { fromKg, roundWeight } from '../lib/units';
import type { HistoricalSetWithExercise } from '../workouts/allExerciseHistoryQueries';
import type { WorkoutSummary } from '../workouts/workoutQueries';
import { setVolumeKg } from '../workouts/workoutSummary';

// Pure derivation over already-fetched, real lifetime data -- no new query,
// no fabricated achievements/gamification. Two kinds of milestone, both
// directly and reliably computable:
// - a workout-count threshold reached (e.g. "First 100 Workouts") -- only
//   included once the user has actually logged that many completed
//   workouts.
// - a round lifetime-volume threshold crossed, in the user's own display
//   unit -- same "round number in the user's own unit" principle as
//   workouts/progressMilestones.ts's per-exercise "+10 lb improvement"
//   milestones, just applied to cumulative training volume instead of one
//   exercise's weight.

export interface LifetimeMilestone {
  key: string;
  label: string;
  achievedAt: string;
}

const WORKOUT_COUNT_TARGETS: { count: number; label: string }[] = [
  { count: 1, label: 'First Workout' },
  { count: 100, label: 'First 100 Workouts' },
  { count: 200, label: 'First 200 Workouts' },
];

// Round thresholds in each display unit -- not a converted "X kg == Y lb"
// pair, so a threshold always reads as a clean, round number to the user
// regardless of which unit they display in (same reasoning as
// isValidWeightIncrement's per-unit step in lib/units.ts).
const VOLUME_THRESHOLDS_LB = [50_000, 100_000, 250_000, 500_000, 1_000_000];
const VOLUME_THRESHOLDS_KG = [25_000, 50_000, 100_000, 250_000, 500_000];

/**
 * Lifetime milestones: which workout-count thresholds the user has reached
 * (from `workouts`, already sorted oldest-first by fetchAllCompletedWorkouts)
 * and the highest round lifetime-volume threshold crossed so far (a
 * chronological running sum over `history`, in the user's display unit).
 * Sorted by when each was achieved. Returns fewer than the full target list
 * whenever the user genuinely hasn't reached a given threshold yet -- never
 * a placeholder row for an unmet milestone.
 */
export function computeLifetimeMilestones(
  workouts: WorkoutSummary[],
  history: HistoricalSetWithExercise[],
  weightUnit: 'kg' | 'lb',
): LifetimeMilestone[] {
  const milestones: LifetimeMilestone[] = [];

  for (const target of WORKOUT_COUNT_TARGETS) {
    const workout = workouts[target.count - 1];
    if (workout) {
      milestones.push({
        key: `workouts-${target.count}`,
        label: target.label,
        achievedAt: workout.performedAt,
      });
    }
  }

  const thresholds = weightUnit === 'lb' ? VOLUME_THRESHOLDS_LB : VOLUME_THRESHOLDS_KG;
  const chronological = [...history].sort(
    (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime(),
  );
  let cumulativeKg = 0;
  let thresholdIndex = 0;
  let highestCrossed: { threshold: number; achievedAt: string } | null = null;
  for (const set of chronological) {
    cumulativeKg += setVolumeKg(set);
    const cumulativeDisplay = roundWeight(fromKg(cumulativeKg, weightUnit));
    while (thresholdIndex < thresholds.length && cumulativeDisplay >= thresholds[thresholdIndex]) {
      highestCrossed = { threshold: thresholds[thresholdIndex], achievedAt: set.performedAt };
      thresholdIndex++;
    }
  }
  if (highestCrossed) {
    milestones.push({
      key: `volume-${highestCrossed.threshold}`,
      label: `Hit ${highestCrossed.threshold.toLocaleString()} ${weightUnit} Volume`,
      achievedAt: highestCrossed.achievedAt,
    });
  }

  return milestones.sort(
    (a, b) => new Date(a.achievedAt).getTime() - new Date(b.achievedAt).getTime(),
  );
}
