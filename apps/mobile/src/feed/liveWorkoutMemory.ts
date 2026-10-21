import { recallShown, rememberShown } from '../lib/lastShown';
import type { WorkoutSummary } from '../workouts/workoutQueries';

// The person's own open workout, as last known -- part of what Feed last showed
// (lib/lastShown.ts: in memory, per user, forgotten on sign-out). Feed sets it from its
// own check, and the live workout sets it as it opens and clears it when it's finished or
// cancelled, so Feed, opened fresh on every tab switch, shows the workout going at once
// instead of "start your next workout" until its own check comes back. Feed still checks on
// every focus; this only decides what's on screen in the meantime.

const KEY = 'feed.liveWorkout';

/** Notes the person's open workout, or that none is open. */
export function rememberLiveWorkout(userId: string | undefined, workout: WorkoutSummary | null) {
  rememberShown(userId, KEY, workout);
}

/** The open workout last known: null when known to be none, undefined when not known yet. */
export function recallLiveWorkout(userId: string | undefined): WorkoutSummary | null | undefined {
  return recallShown<WorkoutSummary | null>(userId, KEY);
}
