import { recordQuietFailure } from '../lib/sentry';
import { fetchNextWorkout } from '../workouts/nextWorkoutQueries';
import { showNextWorkoutWidget } from './widgetUpdates';

/**
 * Next Workout once a workout has ended -- finished (the split moves on) or cancelled (it
 * doesn't) -- worked out the way Feed does, so the widget doesn't wait for Feed to be opened.
 */
export async function refreshNextWorkout(userId: string, activeSplitId: string | null) {
  try {
    if (!activeSplitId) {
      await showNextWorkoutWidget(null, null);
      return;
    }
    await showNextWorkoutWidget(null, await fetchNextWorkout(userId, activeSplitId));
  } catch (error) {
    recordQuietFailure('widget.nextWorkout', error);
  }
}
