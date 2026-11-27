import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { unregisterPushToken } from './notificationsApi';

/**
 * Asks for notification permission (iOS shows its prompt only if it hasn't
 * been answered yet) and reports whether it is granted. iOS only for now --
 * Android returns false immediately, without even prompting.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Requests notification permission and returns this device's Expo push
 * token, or null if permission was denied. iOS only for now -- Android
 * returns null immediately, without even prompting.
 */
export async function requestPushToken(): Promise<string | null> {
  if (!(await requestNotificationPermission())) return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );
  return token;
}

/**
 * This device's Expo push token without asking for anything -- null where notifications aren't
 * allowed (yet), on Android, or where the token can't be had (Expo Go without a project).
 */
export async function currentPushToken(): Promise<string | null> {
  if (Platform.OS !== 'ios') return null;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    return data;
  } catch {
    return null;
  }
}

/** The app icon's badge: their unread notifications. Never fails anything. */
export async function setAppBadge(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(Math.max(0, count));
  } catch {
    // The badge is a nicety.
  }
}

/**
 * Signing out: this device stops getting the person's pushes (its token removed, waiting at most a
 * few seconds -- signing out never hangs on it) and its badge clears.
 */
export async function forgetThisDevice(accessToken: string | null | undefined): Promise<void> {
  try {
    const token = accessToken ? await currentPushToken() : null;
    if (accessToken && token) {
      await Promise.race([
        unregisterPushToken(accessToken, token).catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    }
  } catch {
    // Best effort: the server also moves a token to whoever registers it next.
  }
  await setAppBadge(0);
}
