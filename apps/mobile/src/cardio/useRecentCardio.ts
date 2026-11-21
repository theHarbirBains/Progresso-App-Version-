import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import type { CardioActivity } from './cardioActivities';
import { fetchRecentCardioActivities } from './cardioQueries';

/**
 * The cardio the signed-in person did last, most recent first, so Add Cardio offers it first --
 * read once as the page using it opens (by the time + Add is tapped, it's in). None until then,
 * or if the read fails: the activities just show in their usual order.
 */
export function useRecentCardio(): CardioActivity[] {
  const { user } = useAuth();
  const userId = user?.id;
  const [recent, setRecent] = useState<CardioActivity[]>([]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchRecentCardioActivities(userId).then((activities) => {
      if (!cancelled) setRecent(activities);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  return recent;
}
