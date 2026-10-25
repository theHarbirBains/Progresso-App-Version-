import type { RootStackParamList } from '../navigation/types';
import { applyPlanToWorkout, fetchDayPlan } from './splitPlanQueries';
import { createWorkout, type WorkoutSummary } from './workoutQueries';

export type StartedWorkout =
  /** One is already open (a person has one at a time): resume it instead. */
  | { type: 'conflict'; existingWorkout: WorkoutSummary }
  /** Started: where the live workout opens. */
  | { type: 'started'; params: RootStackParamList['ActiveWorkout'] };

/**
 * Starts a workout -- a split day's, tagged with that day and with the day's plan copied in as it
 * starts (splitPlanQueries.ts), or an improvised one with no day -- and says where the live
 * workout opens. Shared by Start Workout and the Workouts tab's Next Workout, so both start a day
 * the same way. A plan that only partly copies still starts the workout; the live workout says
 * what didn't make it.
 */
export async function startPlannedWorkout(
  userId: string,
  name: string,
  dayId: string | undefined,
): Promise<StartedWorkout> {
  const plan = dayId ? await fetchDayPlan(dayId) : [];
  const result = await createWorkout(userId, name, dayId);
  if (result.type === 'conflict') {
    return { type: 'conflict', existingWorkout: result.existingWorkout };
  }
  let planError: string | undefined;
  try {
    await applyPlanToWorkout(result.workout.id, plan);
  } catch (err) {
    // The workout has started; what was added stays, and the live workout says the rest
    // didn't make it, so it can be added by hand.
    planError = `Not all of this day's plan could be added (${err instanceof Error ? err.message : 'unknown error'}). Add the rest with Add Exercise.`;
  }
  return {
    type: 'started',
    params: {
      workoutId: result.workout.id,
      ...(plan.length > 0 ? { planned: true } : {}),
      ...(planError ? { planError } : {}),
    },
  };
}
