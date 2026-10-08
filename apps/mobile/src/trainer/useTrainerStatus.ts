import { useEffect, useState } from 'react';
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
  const accessToken = session?.access_token;
  const userId = user?.id;
  const [isTrainer, setIsTrainer] = useState(false);

  useEffect(() => {
    if (!accessToken || !userId) {
      setIsTrainer(false);
      return;
    }
    let cancelled = false;
    async function load() {
      // Independent of each other -- attaching an invite doesn't change whether this
      // account is a trainer, so there is nothing for one to wait on from the other.
      // Each call is deferred into its own `.then` (rather than invoked directly as a
      // Promise.allSettled array element) so a failure -- including the call itself
      // throwing, not just its promise rejecting -- is isolated to that one entry and
      // never stops the other from settling.
      const [, statusResult] = await Promise.allSettled([
        Promise.resolve().then(() => claimTrainerInvites(accessToken!)),
        Promise.resolve().then(() => getTrainerStatus(accessToken!)),
      ]);
      if (!cancelled) {
        setIsTrainer(statusResult.status === 'fulfilled' ? statusResult.value.isTrainer : false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, userId]);

  return isTrainer;
}
