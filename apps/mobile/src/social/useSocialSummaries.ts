import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getSocialSummary, likeWorkout, unlikeWorkout, type SocialSummary } from '../lib/api';
import { recallShown, rememberShown } from '../lib/lastShown';

/**
 * Likes and comments for the workouts a page shows (Feed, a profile), read each time that list
 * of workouts changes -- they change elsewhere (someone else likes or comments), so they're
 * never cached. A like shows at once and is undone if it doesn't save. A workout missing from
 * the result is one the server won't share likes for (a trainer's logging, say): no bar.
 * With `rememberAs` (Feed), a reopened page starts from the counts it last showed
 * (lib/lastShown.ts) while they're read again, so its bars are there with its cards.
 */
export function useSocialSummaries(workoutIds: string[], rememberAs?: string) {
  const { session, user } = useAuth();
  const accessToken = session?.access_token;
  const userId = user?.id;
  const [remembered] = useState(() =>
    rememberAs ? recallShown<Record<string, SocialSummary>>(userId, rememberAs) : undefined,
  );
  const [summaries, setSummaries] = useState<Record<string, SocialSummary>>(remembered ?? {});
  const key = workoutIds.join(',');
  const latest = useRef(key);
  // The list whose read has finished (or failed) -- with what was remembered, the page has its
  // counts already.
  const [settledKey, setSettledKey] = useState<string | null>(null);
  const loaded = key === '' || settledKey === key || remembered !== undefined;

  const read = useCallback(async () => {
    if (!accessToken || key === '') return;
    latest.current = key;
    try {
      const result = await getSocialSummary(accessToken, key.split(','));
      // Only the latest read counts.
      if (latest.current === key) {
        setSummaries(result);
        if (rememberAs) rememberShown(userId, rememberAs, result);
      }
    } catch {
      // Likes and comments are extra: the workouts show without them.
    } finally {
      if (latest.current === key) setSettledKey(key);
    }
  }, [accessToken, key, rememberAs, userId]);

  useEffect(() => {
    void read();
  }, [read]);

  const toggleLike = useCallback(
    async (workoutId: string) => {
      const current = summaries[workoutId];
      if (!accessToken || !current) return;
      const liking = !current.likedByMe;
      const flip = (likedByMe: boolean, delta: number) =>
        setSummaries((prev) => {
          const entry = prev[workoutId];
          return entry
            ? { ...prev, [workoutId]: { ...entry, likedByMe, likeCount: entry.likeCount + delta } }
            : prev;
        });
      flip(liking, liking ? 1 : -1);
      try {
        if (liking) await likeWorkout(accessToken, workoutId);
        else await unlikeWorkout(accessToken, workoutId);
      } catch {
        flip(!liking, liking ? -1 : 1);
      }
    },
    [accessToken, summaries],
  );

  return { summaries, toggleLike, refresh: read, loaded };
}
