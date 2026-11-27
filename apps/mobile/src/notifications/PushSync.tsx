import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../auth/AuthProvider';
import {
  fetchUnreadNotificationCount,
  markNotificationsRead,
  registerPushToken,
} from '../lib/notificationsApi';
import { currentPushToken, setAppBadge } from '../lib/pushNotifications';
import { useProfileIfAny } from '../profile/profileContext';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The server's notification a tapped push is about -- its record's id -- if it is one. */
export function notificationIdOf(
  response: Notifications.NotificationResponse | null | undefined,
): string | null {
  const data = response?.notification?.request?.content?.data as
    Record<string, unknown> | undefined;
  const id = data?.notificationId;
  return typeof id === 'string' && UUID.test(id) ? id : null;
}

/**
 * Keeps this phone's part in push notifications right while someone's signed in, and fetches
 * nothing else:
 * - **Its token**, registered to them (and only them -- the server moves it from anyone signed in
 *   on this phone before) as the app opens and comes back to the front, and whenever iOS hands it
 *   a new one -- only if they said yes to notifications and the phone allows them, never asking.
 *   Signing out removes it (AuthProvider), so the next person on this phone never gets theirs.
 * - **A tapped notification** (the app open, in the background or closed) is marked read; the
 *   app's links open its screen (navigation/linking.ts).
 * - **The app icon's badge**: their unread notifications, as the app opens and comes back.
 */
export function PushSync() {
  const { session, user, status } = useAuth();
  const accessToken = session?.access_token ?? null;
  const userId = user?.id ?? null;
  const optedIn = useProfileIfAny()?.pushNotificationsOptIn === true;
  // Registered already, this session: "<user>:<token>".
  const registered = useRef<string | null>(null);
  const handled = useRef(new Set<string>());
  // The latest token for the async work below, without re-running it on every refresh.
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;

  useEffect(() => {
    if (status === 'signedOut') {
      registered.current = null;
      void setAppBadge(0);
    }
  }, [status]);

  // This device's token, registered to them.
  useEffect(() => {
    if (!userId || !optedIn) return undefined;
    let cancelled = false;
    const register = async (given?: string | null) => {
      const token = given ?? (await currentPushToken());
      const access = tokenRef.current;
      if (!token || !access || cancelled) return;
      const key = `${userId}:${token}`;
      if (registered.current === key) return;
      try {
        await registerPushToken(access, token, 'ios');
        registered.current = key;
      } catch {
        // Tried again as the app next comes back.
      }
    };
    void register();
    const tokens = Notifications.addPushTokenListener(({ data }) => {
      if (typeof data === 'string') void register(data);
    });
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') void register();
    });
    return () => {
      cancelled = true;
      tokens.remove();
      app.remove();
    };
  }, [userId, optedIn]);

  // A tapped notification is read; the badge follows.
  useEffect(() => {
    if (!userId) return undefined;
    const markRead = (response: Notifications.NotificationResponse | null | undefined) => {
      const id = notificationIdOf(response);
      const access = tokenRef.current;
      if (!id || !access || handled.current.has(id)) return;
      handled.current.add(id);
      markNotificationsRead(access, [id])
        .then(({ unread }) => setAppBadge(unread))
        .catch(() => {
          handled.current.delete(id);
        });
    };
    markRead(Notifications.getLastNotificationResponse());
    const taps = Notifications.addNotificationResponseReceivedListener(markRead);
    return () => taps.remove();
  }, [userId]);

  // The icon's badge: how many are unread.
  useEffect(() => {
    if (!userId) return undefined;
    const refresh = () => {
      const access = tokenRef.current;
      if (!access) return;
      fetchUnreadNotificationCount(access)
        .then(({ unread }) => setAppBadge(unread))
        .catch(() => {});
    };
    refresh();
    const app = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => app.remove();
  }, [userId]);

  return null;
}
