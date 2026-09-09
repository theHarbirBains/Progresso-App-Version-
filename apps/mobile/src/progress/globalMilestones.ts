// Account-wide achievement milestones (distinct from progressMilestones.ts's
// per-exercise progression milestones). Deliberately count-based only for
// now: total workouts and total completed sets are direct, reliable counts
// with zero risk of a fabricated number, so this is the frontend/foundation
// for the Milestones section while the fuller milestone concept (e.g.
// exercise-specific round-number achievements) is still being decided.
export interface GlobalMilestone {
  key: string;
  label: string;
  achieved: boolean;
  achievedAt: string | null;
  /** Progress toward this milestone, e.g. { current: 47, target: 100 }. Omitted once achieved -- nothing left to show progress toward. */
  progress: { current: number; target: number } | null;
}

const WORKOUT_THRESHOLDS = [1, 10, 50, 100, 250, 500, 1000];
const SET_THRESHOLDS = [1, 100, 500, 1000, 5000, 10000];

function formatCount(n: number): string {
  return n.toLocaleString();
}

/** The next not-yet-reached threshold in an ascending list, or the last one if all are reached. */
function nextThreshold(thresholds: number[], current: number): number {
  return thresholds.find((t) => t > current) ?? thresholds[thresholds.length - 1];
}

/**
 * Real, count-based milestones only: first workout, first PR, and the next
 * unreached workout-count / completed-set-count threshold. Restrained by
 * design (never the full threshold list at once) so this doesn't read as
 * meaningless badge spam.
 */
export function deriveGlobalMilestones(input: {
  totalWorkouts: number;
  totalCompletedSets: number;
  firstWorkoutAt: string | null;
  firstPRAt: string | null;
}): GlobalMilestone[] {
  const { totalWorkouts, totalCompletedSets, firstWorkoutAt, firstPRAt } = input;
  const milestones: GlobalMilestone[] = [];

  milestones.push({
    key: 'first-workout',
    label: 'First Workout',
    achieved: firstWorkoutAt !== null,
    achievedAt: firstWorkoutAt,
    progress: null,
  });

  milestones.push({
    key: 'first-pr',
    label: 'First PR',
    achieved: firstPRAt !== null,
    achievedAt: firstPRAt,
    progress: null,
  });

  const workoutTarget = nextThreshold(WORKOUT_THRESHOLDS, totalWorkouts);
  milestones.push({
    key: `workouts-${workoutTarget}`,
    label: `${formatCount(workoutTarget)} Workouts`,
    achieved: totalWorkouts >= workoutTarget,
    achievedAt: null,
    progress:
      totalWorkouts >= workoutTarget ? null : { current: totalWorkouts, target: workoutTarget },
  });

  const setTarget = nextThreshold(SET_THRESHOLDS, totalCompletedSets);
  milestones.push({
    key: `sets-${setTarget}`,
    label: `${formatCount(setTarget)} Sets Completed`,
    achieved: totalCompletedSets >= setTarget,
    achievedAt: null,
    progress:
      totalCompletedSets >= setTarget ? null : { current: totalCompletedSets, target: setTarget },
  });

  return milestones;
}
