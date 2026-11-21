import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { fetchRecentCardio, type CardioHistoryEntry } from './cardioQueries';

/**
 * The last time the signed-in person did each activity, most recent first (fetchRecentCardio) --
 * so Add Cardio offers those first and the live workout's Cardio page can show Last Time. Read
 * once as the page using it opens (by the time + Add is tapped, it's in); the finished workouts
 * it comes from don't change meanwhile. None until then, or if the read fails: the activities
 * just show in their usual order, with no Last Time.
 */
export function useRecentCardio(excludeWorkoutId?: string): CardioHistoryEntry[] {
  const { user } = useAuth();
  const userId = user?.id;
  const [recent, setRecent] = useState<CardioHistoryEntry[]>([]);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void fetchRecentCardio(userId, excludeWorkoutId).then((entries) => {
      if (!cancelled) setRecent(entries);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, excludeWorkoutId]);
  return recent;
}
