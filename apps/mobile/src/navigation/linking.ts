import type { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useEffect, useMemo, useRef } from 'react';
import { notificationLink } from '../notifications/reminderScheduler';
import type { RootStackParamList } from './types';

/**
 * The screens a link can open, e.g. progresso://workouts/<id>. Each opens on top of Feed, so
 * Back lands there. A link to any other path just starts the app on Feed. A tapped reminder
 * carries one of these too (notifications/reminderPlan.ts).
 */
export const LINK_CONFIG: NonNullable<LinkingOptions<RootStackParamList>['config']> = {
  initialRouteName: 'Feed',
  screens: {
    Feed: 'feed',
    Nutrition: 'nutrition',
    ProgressOverview: 'progress',
    NewWorkout: 'workouts/new',
    WorkoutDetail: 'workouts/:workoutId',
    ActiveWorkout: 'workouts/:workoutId/live',
    GroupSession: 'groups/:groupId',
  },
};

// The links AuthProvider handles itself: the sign-in redirect, email confirmation and password
// reset. They carry a session, not a screen, so the navigator never acts on them.
const AUTH_LINK_PATHS = new Set(['auth-callback', 'confirm-email', 'reset-password']);

/** Whether a URL is one of the auth links, for progresso:// and Expo Go's exp://host/--/ alike. */
export function isAuthLink(url: string): boolean {
  const afterScheme = url.replace(/^[^:]+:\/\//, '');
  const path = afterScheme.split('/--/')[1] ?? afterScheme;
  const firstSegment = path.replace(/^\/+/, '').split(/[/?#]/)[0] ?? '';
  return AUTH_LINK_PATHS.has(firstSegment);
}

// React Navigation's own default: getInitialURL can hang on some devices, so stop waiting.
const INITIAL_URL_WAIT_MS = 150;

/**
 * The navigator's linking options. Links only open once the user is signed in: the navigator
 * only exists then, and a link that arrives while signed out is held until it does. The link
 * that launched the app is used once, so signing out and back in starts on Feed again. A tapped
 * reminder opens its link the same way -- the one that launched the app, or one tapped while
 * it's open. Call from the component that stays mounted across sign-in and sign-out (App.tsx's
 * Root).
 */
export function useAppLinking(signedIn: boolean): LinkingOptions<RootStackParamList> {
  const heldLink = useRef<string | null>(null);
  const launchLinkUsed = useRef(false);

  // Once signed in, the navigator listens for links itself.
  useEffect(() => {
    if (signedIn) return;
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!isAuthLink(url)) heldLink.current = url;
    });
    return () => subscription.remove();
  }, [signedIn]);

  return useMemo(
    () => ({
      prefixes: [Linking.createURL('/')],
      filter: (url: string) => !isAuthLink(url),
      config: LINK_CONFIG,
      getInitialURL: () => {
        const held = heldLink.current;
        const firstStart = !launchLinkUsed.current;
        heldLink.current = null;
        launchLinkUsed.current = true;
        if (held !== null) return held;
        if (!firstStart) return null;
        return Promise.race([
          Linking.getInitialURL(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), INITIAL_URL_WAIT_MS)),
        ]).then((url) => url ?? launchingNotificationLink());
      },
      subscribe: (listener: (url: string) => void) => {
        const links = Linking.addEventListener('url', ({ url }) => listener(url));
        const taps = Notifications.addNotificationResponseReceivedListener((response) => {
          const url = notificationLink(response);
          if (url) listener(url);
        });
        return () => {
          links.remove();
          taps.remove();
        };
      },
    }),
    [],
  );
}

/** The link of the reminder whose tap launched the app, if one did. */
function launchingNotificationLink(): string | null {
  try {
    return notificationLink(Notifications.getLastNotificationResponse());
  } catch {
    return null;
  }
}
