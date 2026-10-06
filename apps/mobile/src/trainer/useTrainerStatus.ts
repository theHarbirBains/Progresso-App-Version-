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
      try {
        await claimTrainerInvites(accessToken!);
      } catch {
        // Invites are attached on the next launch; nothing to show now.
      }
      try {
        const status = await getTrainerStatus(accessToken!);
        if (!cancelled) setIsTrainer(status.isTrainer);
      } catch {
        if (!cancelled) setIsTrainer(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [accessToken, userId]);

  return isTrainer;
}
