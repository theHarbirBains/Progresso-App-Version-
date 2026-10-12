import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';

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
