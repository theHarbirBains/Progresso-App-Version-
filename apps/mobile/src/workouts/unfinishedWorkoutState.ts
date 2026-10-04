import { computeDurationMinutes } from './topSetSummary';

// Provisional thresholds. The first calibration sample (5 completed workouts,
// 23 set-to-set gaps) was too small to tune against, so these are chosen to
// sit well outside the observed gaps (p99 between sets ~26 min) and should be
// revisited once there is a real population of completed workouts.
export const UNFINISHED_THRESHOLDS = {
  /** Idle time before the workout is merely "possibly inactive" (banner indicator only). */
  possiblyInactiveMinutes: 45,
  /** Idle time before a workout with real activity is "suspected complete" (confirmation prompt). */
  suspectedCompleteMinutes: 120,
  /** Below this many completed sets a workout is too thin to prompt about; it gets the banner only. */
  minCompletedSetsForPrompt: 3,
} as const;

export type UnfinishedWorkoutState =
  'active' | 'possibly_inactive' | 'suspected_complete' | 'stale';

export interface UnfinishedWorkoutInput {
  performedAt: string;
  /** completed_at of each completed (weight, reps and completed_at all set) set -- live sets only. */
  completedSetTimes: string[];
  /** Live sets added but never filled in (completed_at null). */
  plannedBlankSetCount: number;
  /** Live, non-deleted exercises in the workout. */
  exerciseCount: number;
  /** Completed exercises: those with at least one completed set. */
  completedExerciseCount: number;
}

export interface UnfinishedWorkoutAssessment {
  state: UnfinishedWorkoutState;
  /** Latest completed-set time, or the workout's start when nothing was completed. */
  lastActivityAt: string;
  idleMinutes: number;
  completedSetCount: number;
  completedExerciseCount: number;
  plannedBlankSetCount: number;
  /**
   * Suggested end time if the user confirms Finish: the last completed set,
   * never later than `now` (device clocks can drift). Null when nothing was
   * completed, since there is no evidence of an end time.
   */
  suggestedEndAt: string | null;
  /** Duration implied by suggestedEndAt, or null when there is no suggestion. */
  suggestedDurationMinutes: number | null;
}

function latestTime(times: string[]): string | null {
  let latest: string | null = null;
  for (const time of times) {
    if (latest === null || new Date(time).getTime() > new Date(latest).getTime()) latest = time;
  }
  return latest;
}

/**
 * Derives an open workout's recovery state from its own rows and the current
 * time. Pure: no I/O and no stored state, so a kill, restart or offline period
 * gives the same answer on the next evaluation.
 *
 * Nothing here finishes or discards a workout. A "suspected_complete" result
 * only means the UI may ask the user; the user's tap is the only thing that
 * writes completed_at.
 */
export function assessUnfinishedWorkout(
  workout: UnfinishedWorkoutInput,
  now: Date,
): UnfinishedWorkoutAssessment {
  const completedSetCount = workout.completedSetTimes.length;
  const latestCompletedAt = latestTime(workout.completedSetTimes);
  const lastActivityAt = latestCompletedAt ?? workout.performedAt;

  const rawIdleMs = now.getTime() - new Date(lastActivityAt).getTime();
  const idleMinutes = Number.isFinite(rawIdleMs) ? Math.max(0, rawIdleMs / 60000) : 0;

  // Calendar-day rollover uses the device's local day, the same convention
  // FoodLogProvider uses for "today".
  const lastActivityDate = new Date(lastActivityAt);
  const crossedDay =
    Number.isFinite(lastActivityDate.getTime()) &&
    lastActivityDate.toDateString() !== now.toDateString();

  const suggestedEndAt =
    latestCompletedAt === null
      ? null
      : new Date(Math.min(new Date(latestCompletedAt).getTime(), now.getTime())).toISOString();
  const suggestedDurationMinutes =
    suggestedEndAt === null ? null : computeDurationMinutes(workout.performedAt, suggestedEndAt);

  let state: UnfinishedWorkoutState;
  if (completedSetCount < UNFINISHED_THRESHOLDS.minCompletedSetsForPrompt) {
    // Too little logged to ask about. Once it has clearly gone quiet or the
    // day has rolled over, it is stale: the banner stays and Discard lives in
    // the existing cancel flow, never in an automatic prompt.
    state =
      crossedDay || idleMinutes >= UNFINISHED_THRESHOLDS.suspectedCompleteMinutes
        ? 'stale'
        : idleMinutes >= UNFINISHED_THRESHOLDS.possiblyInactiveMinutes
          ? 'possibly_inactive'
          : 'active';
  } else if (crossedDay || idleMinutes >= UNFINISHED_THRESHOLDS.suspectedCompleteMinutes) {
    state = 'suspected_complete';
  } else if (idleMinutes >= UNFINISHED_THRESHOLDS.possiblyInactiveMinutes) {
    state = 'possibly_inactive';
  } else {
    state = 'active';
  }

  return {
    state,
    lastActivityAt,
    idleMinutes,
    completedSetCount,
    completedExerciseCount: workout.completedExerciseCount,
    plannedBlankSetCount: workout.plannedBlankSetCount,
    suggestedEndAt,
    suggestedDurationMinutes,
  };
}
