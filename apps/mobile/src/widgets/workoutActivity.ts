import type { LiveActivity } from 'expo-widgets';
import { recordQuietFailure } from '../lib/sentry';
import { withWidgets } from './loadWidgets';
import type { WorkoutActivityProps } from './widgetProps';

// The Lock Screen card (an iOS Live Activity) while a workout is going: its name, whose it is,
// and a timer the card runs on its own from when it started. One at a time. It starts when the
// live workout or group workout opens, ends when it's finished or cancelled, and Feed, which
// checks what's open on every visit, ends one whose workout isn't open any more (finished on
// another phone, say). The card the app last started is remembered while the app runs; after a
// restart it only knows cards exist, not whose, so it ends those only when nothing is open.

type Card = LiveActivity<WorkoutActivityProps>;

/** The workout the card shows ("workout:<id>" or "group:<id>"), noted before it's started. */
let shown: { key: string } | null = null;

async function endEach(cards: Card[]) {
  await Promise.all(
    cards.map((card) =>
      card
        .end('immediate')
        .catch((error: unknown) => recordQuietFailure('widget.workoutActivity', error)),
    ),
  );
}

/** Shows `workout` on the Lock Screen, in place of any other workout's card. */
export async function showWorkoutActivity(
  key: string,
  props: WorkoutActivityProps,
  url: string,
): Promise<void> {
  if (shown?.key === key) return;
  shown = { key };
  await withWidgets('workoutActivity', async ({ workoutActivity }) => {
    // Started before the others end, so two calls close together never leave two cards.
    const others = workoutActivity.getInstances();
    try {
      workoutActivity.start(props, url);
    } catch (error) {
      // Live Activities turned off for the app, or the system refusing one: the workout goes on.
      recordQuietFailure('widget.workoutActivity', error);
    }
    await endEach(others);
  });
}

/** Ends the card: the workout was finished or cancelled, or the person signed out. */
export async function endWorkoutActivities(): Promise<void> {
  shown = null;
  await withWidgets('workoutActivity', ({ workoutActivity }) =>
    endEach(workoutActivity.getInstances()),
  );
}

/** Ends the card if it's this workout's -- a group found finished when it's opened. */
export async function endWorkoutActivity(key: string): Promise<void> {
  if (shown?.key === key) await endWorkoutActivities();
}

/**
 * Ends the card unless its workout is still open. `openKeys` is everything open right now,
 * from Feed's own check.
 */
export async function endClosedWorkoutActivities(openKeys: string[]): Promise<void> {
  if (shown) {
    if (!openKeys.includes(shown.key)) await endWorkoutActivities();
    return;
  }
  if (openKeys.length === 0) await endWorkoutActivities();
}
