import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { claimTrainerInvites, getTrainerStatus } from '../lib/api';

/** When a failed check is tried again, after the first attempt. */
export const TRAINER_STATUS_RETRY_DELAYS_MS = [5_000, 15_000, 45_000];

/**
 * Whether the signed-in person can use trainer mode. It also attaches any
 * invites waiting for their email, so an invite reaches them the next time they
 * open the app, whether or not they already had an account. Both calls are
 * best-effort. A status check that fails (a cold or unreachable API) is tried
 * again a few times, and again whenever the app comes back to the foreground,
 * until one succeeds -- so a trainer whose first check fails still gets their
 * workspace without relaunching. A failed invite claim is retried alongside it.
 */
export function useTrainerStatus(): boolean {
  const { session, user } = useAuth();
  const userId = user?.id;
  // Read at call time, so the hourly token refresh doesn't re-run both calls for the same person.
  const accessTokenRef = useRef(session?.access_token);
  accessTokenRef.current = session?.access_token;
  const [isTrainer, setIsTrainer] = useState(false);

  useEffect(() => {
    if (!accessTokenRef.current || !userId) {
      setIsTrainer(false);
      return;
    }
    let cancelled = false;
    let known = false;
    let claimed = false;
    let inFlight = false;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    async function load() {
      const token = accessTokenRef.current;
      if (!token || inFlight || known) return;
      inFlight = true;
      // Independent of each other -- attaching an invite doesn't change whether this
      // account is a trainer, so there is nothing for one to wait on from the other.
      // Each call is deferred into its own `.then` (rather than invoked directly as a
      // Promise.allSettled array element) so a failure -- including the call itself
      // throwing, not just its promise rejecting -- is isolated to that one entry and
      // never stops the other from settling.
      const [claimResult, statusResult] = await Promise.allSettled([
        claimed ? Promise.resolve(null) : Promise.resolve().then(() => claimTrainerInvites(token)),
        Promise.resolve().then(() => getTrainerStatus(token)),
      ]);
      inFlight = false;
      if (cancelled) return;
      if (claimResult.status === 'fulfilled') claimed = true;
      if (statusResult.status === 'fulfilled') {
        known = true;
        setIsTrainer(statusResult.value.isTrainer);
        return;
      }
      const delay = TRAINER_STATUS_RETRY_DELAYS_MS[retries];
      retries += 1;
      if (delay !== undefined) retryTimer = setTimeout(() => void load(), delay);
    }

    void load();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || known) return;
      clearTimeout(retryTimer);
      retries = 0;
      void load();
    });

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      subscription.remove();
    };
  }, [userId]);

  return isTrainer;
}
