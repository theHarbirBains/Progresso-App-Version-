import { recordQuietFailure } from '../lib/sentry';
import { computeNextWorkout } from '../workouts/nextWorkout';
import {
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
} from '../workouts/workoutSplitQueries';
import { showNextWorkoutWidget } from './widgetUpdates';

/**
 * Next Workout once a workout has ended -- finished (the split moves on) or cancelled (it
 * doesn't) -- worked out the way Feed does, so the widget doesn't wait for Feed to be opened.
 */
export async function refreshNextWorkout(userId: string, activeSplitId: string | null) {
  try {
    if (!activeSplitId) {
      showNextWorkoutWidget(null, null);
      return;
    }
    const [detail, lastDayId] = await Promise.all([
      fetchWorkoutSplitDetail(activeSplitId),
      fetchLastWorkoutSplitDayId(userId),
    ]);
    showNextWorkoutWidget(null, computeNextWorkout(detail, lastDayId));
  } catch (error) {
    recordQuietFailure('widget.nextWorkout', error);
  }
}
