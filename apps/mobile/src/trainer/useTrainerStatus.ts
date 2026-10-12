import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { claimTrainerInvites, getTrainerStatus } from '../lib/api';

/**
 * Whether the signed-in person can use trainer mode. It also attaches any
 * invites waiting for their email, so an invite reaches them the next time they
 * open the app, whether or not they already had an account. Both calls are
 * best-effort: a failure leaves the menu without the trainer entry, and the next
 * launch tries again.
 */
export function useTrainerStatus(): boolean {
  const { session, user } = useAuth();
  const userId = user?.id;
  // Read at call time, so the hourly token refresh doesn't re-run both calls for the same person.
  const accessTokenRef = useRef(session?.access_token);
  accessTokenRef.current = session?.access_token;
  const [isTrainer, setIsTrainer] = useState(false);

  useEffect(() => {
    const accessToken = accessTokenRef.current;
    if (!accessToken || !userId) {
      setIsTrainer(false);
      return;
    }
    let cancelled = false;
    async function load(token: string) {
      // Independent of each other -- attaching an invite doesn't change whether this
      // account is a trainer, so there is nothing for one to wait on from the other.
      // Each call is deferred into its own `.then` (rather than invoked directly as a
      // Promise.allSettled array element) so a failure -- including the call itself
      // throwing, not just its promise rejecting -- is isolated to that one entry and
      // never stops the other from settling.
      const [, statusResult] = await Promise.allSettled([
        Promise.resolve().then(() => claimTrainerInvites(token)),
        Promise.resolve().then(() => getTrainerStatus(token)),
      ]);
      if (!cancelled) {
        setIsTrainer(statusResult.status === 'fulfilled' ? statusResult.value.isTrainer : false);
      }
    }
    void load(accessToken);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return isTrainer;
}
