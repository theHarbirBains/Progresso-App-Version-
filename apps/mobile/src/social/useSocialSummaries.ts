import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getSocialSummary, likeWorkout, unlikeWorkout, type SocialSummary } from '../lib/api';

/**
 * Likes and comments for the workouts a page shows (Feed, a profile), read each time that list
 * of workouts changes -- they change elsewhere (someone else likes or comments), so they're
 * never cached. A like shows at once and is undone if it doesn't save. A workout missing from
 * the result is one the server won't share likes for (a trainer's logging, say): no bar.
 */
export function useSocialSummaries(workoutIds: string[]) {
  const accessToken = useAuth().session?.access_token;
  const [summaries, setSummaries] = useState<Record<string, SocialSummary>>({});
  const key = workoutIds.join(',');
  const latest = useRef(key);

  const read = useCallback(async () => {
    if (!accessToken || key === '') return;
    latest.current = key;
    try {
      const result = await getSocialSummary(accessToken, key.split(','));
      // Only the latest read counts.
      if (latest.current === key) setSummaries(result);
    } catch {
      // Likes and comments are extra: the workouts show without them.
    }
  }, [accessToken, key]);

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

  return { summaries, toggleLike, refresh: read };
}
