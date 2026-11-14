import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { recordQuietFailure } from '../lib/sentry';
import { formatWeightKg } from '../lib/units';
import type { ShareTopSet } from '../sharing/shareCardData';
import { REMINDER_ID_PREFIX, type PlannedReminder } from './reminderPlan';

// Puts the reminder plan on the phone (expo-notifications' local notifications -- nothing is
// sent from a server, and nothing leaves the phone), and cheers a new PR. iPhone only, like the
// rest of Progresso's notifications.

/** Whether notifications may be shown: iPhone, and allowed in its Settings. Never asks. */
export async function notificationsAllowed(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    recordQuietFailure('notifications.permission', error);
    return false;
  }
}

/** Shows a reminder (or a PR cheer) as a banner even while Progresso is open. */
export function showNotificationsInApp() {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

// One run at a time, in the order asked; a plan the same as the last one put on the phone is
// left alone, so logging food doesn't redo a week of reminders each time.
let queue: Promise<void> = Promise.resolve();
let lastScheduled: string | null = null;

function planKey(plan: PlannedReminder[]): string {
  return JSON.stringify(plan.map((r) => [r.id, r.at.getTime(), r.title, r.body, r.path]));
}

async function replaceScheduled(plan: PlannedReminder[]) {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(REMINDER_ID_PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
  for (const reminder of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.title,
        body: reminder.body,
        data: { url: Linking.createURL(reminder.path) },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at },
    });
  }
}

/** Replaces the reminders on the phone with `plan` -- an empty plan clears them. */
export function scheduleReminders(plan: PlannedReminder[]): Promise<void> {
  queue = queue.then(async () => {
    const key = planKey(plan);
    if (key === lastScheduled) return;
    try {
      await replaceScheduled(plan);
      lastScheduled = key;
    } catch (error) {
      lastScheduled = null;
      recordQuietFailure('notifications.schedule', error);
    }
  });
  return queue;
}

/** Clears every reminder -- on sign-out, or once notifications are turned off. */
export function clearReminders(): Promise<void> {
  return scheduleReminders([]);
}

/** For tests: forget what was last put on the phone. */
export function forgetScheduledReminders() {
  lastScheduled = null;
}

/** The link a tapped notification carries, if it's one of Progresso's. */
export function notificationLink(
  response: Notifications.NotificationResponse | null,
): string | null {
  const url = response?.notification.request.content.data?.url;
  return typeof url === 'string' ? url : null;
}

function prValue(topSet: ShareTopSet, unit: 'kg' | 'lb'): string {
  if (topSet.weightKg !== null && topSet.reps !== null) {
    return `${formatWeightKg(topSet.weightKg, unit)} ${unit} × ${topSet.reps}`;
  }
  if (topSet.reps !== null) return `${topSet.reps} reps`;
  if (topSet.durationSeconds !== null) {
    const minutes = Math.floor(topSet.durationSeconds / 60);
    const seconds = topSet.durationSeconds % 60;
    return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds} sec`;
  }
  return 'a new best';
}

/** The cheer for a workout just finished with new PRs, or null with none. */
export function prCheer(
  firstName: string | null,
  workoutName: string,
  topSets: ShareTopSet[],
  unit: 'kg' | 'lb',
): { title: string; body: string } | null {
  const prs = topSets.filter((topSet) => topSet.prLabel !== null);
  if (prs.length === 0) return null;
  const title = firstName ? `KEEP GOING, ${firstName.toUpperCase()}!` : 'KEEP GOING!';
  const first = prs[0];
  const body =
    prs.length === 1
      ? `You hit a new PR on your ${workoutName} workout: ${first.exerciseName}, ${prValue(first, unit)}.`
      : `You hit ${prs.length} new PRs on your ${workoutName} workout, including ${first.exerciseName}, ${prValue(first, unit)}.`;
  return { title, body };
}

/** Shows the cheer at once, as a banner (the app is open: the workout was just finished). */
export async function showPrCheer(cheer: { title: string; body: string }): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: { title: cheer.title, body: cheer.body },
      trigger: null,
    });
  } catch (error) {
    recordQuietFailure('notifications.prCheer', error);
  }
}
