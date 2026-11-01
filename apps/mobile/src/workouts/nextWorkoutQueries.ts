import { computeNextWorkout, type NextWorkoutPlan } from './nextWorkout';
import { fetchLastWorkoutSplitDayId, fetchWorkoutSplitDetail } from './workoutSplitQueries';

/**
 * The person's next workout on their active split, read fresh -- the split and the last day they
 * did, side by side -- for Feed, Workout History and the Next Workout widget alike.
 */
export async function fetchNextWorkout(
  userId: string,
  activeSplitId: string,
): Promise<NextWorkoutPlan | null> {
  const [detail, lastDayId] = await Promise.all([
    fetchWorkoutSplitDetail(activeSplitId),
    fetchLastWorkoutSplitDayId(userId),
  ]);
  return computeNextWorkout(detail, lastDayId);
}
