import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../../auth/AuthProvider';
import { stopBackgroundSync, watchAppleHealth } from './appleHealthRead';
import {
  connectedHere,
  refreshAppleHealth,
  setAppleHealthAuth,
  syncAppleHealthIfDue,
  useAppleHealthSync,
} from './appleHealthSyncStore';
import { APPLE_HEALTH_SYNC_ENABLED } from './appleHealthSyncAvailability';

/** How long after Apple Health's last change it waits, so a burst is one sync. */
const CHANGE_SETTLE_MS = 3000;

/**
 * Keeps Apple Health sync in step with the app, rendering nothing: who's signed in, a sync as the
 * app opens and comes back to the front, and one whenever HealthKit says it has something new --
 * in the background too, where HealthKit wakes Progresso (configureBackgroundTypes). Only in
 * development builds for now (APPLE_HEALTH_SYNC_ENABLED).
 */
export function AppleHealthSync() {
  return APPLE_HEALTH_SYNC_ENABLED ? <AppleHealthSyncWork /> : null;
}

function AppleHealthSyncWork() {
  const { session, user } = useAuth();
  const userId = user?.id ?? null;
  const accessToken = session?.access_token ?? null;
  const signedInAs = useRef<string | null>(null);
  // The effect below runs again only when this flips.
  const connected = connectedHere(useAppleHealthSync());

  useEffect(() => {
    setAppleHealthAuth(userId && accessToken ? { userId, accessToken } : null);
  }, [userId, accessToken]);

  // Signed in: what's there. Signed out: HealthKit stops waking Progresso for them.
  useEffect(() => {
    if (userId) {
      signedInAs.current = userId;
      void refreshAppleHealth();
    } else if (signedInAs.current) {
      signedInAs.current = null;
      void stopBackgroundSync().catch(() => undefined);
    }
  }, [userId]);

  // Connected on this iPhone: a sync now, as the app comes back, and whenever Apple Health changes.
  useEffect(() => {
    if (!userId || !connected) return undefined;
    let cancelled = false;
    let stopWatching: (() => void) | null = null;
    let settle: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => (AppState.currentState === 'active' ? 'app_open' : 'background');

    void syncAppleHealthIfDue(trigger());
    void watchAppleHealth(() => {
      if (settle) clearTimeout(settle);
      settle = setTimeout(() => void syncAppleHealthIfDue(trigger()), CHANGE_SETTLE_MS);
    })
      .then((stop) => {
        if (cancelled) stop();
        else stopWatching = stop;
      })
      .catch(() => undefined);
    const app = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncAppleHealthIfDue('app_open');
    });
    return () => {
      cancelled = true;
      stopWatching?.();
      if (settle) clearTimeout(settle);
      app.remove();
    };
  }, [userId, connected]);

  return null;
}
