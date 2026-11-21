import { useCallback, useEffect, useState } from 'react';
import type { MuscleGroup } from '../exercises/muscleGroups';
import { fetchPreviousExercises, fetchSplitDayMuscleGroups } from './previousExerciseQueries';
import { previousByMuscleGroup, type PreviousMuscleGroup } from './previousExercises';

export interface PreviousExercisesState {
  status: 'loading' | 'ready' | 'error';
  /** Each muscle group's last time, most recently trained first. */
  groups: PreviousMuscleGroup[];
  /** The split day's muscle groups, when the workout is one; empty otherwise. */
  dayGroups: MuscleGroup[];
  retry: () => void;
}

/**
 * Add Exercise's previous exercises for a live workout: the person's last time for each muscle
 * group, and the split day's muscle groups when it's one. Read once as the workout opens -- the
 * finished workouts they come from don't change while it's going -- so by the time Add
 * Exercise is tapped they're in. `splitDayId` undefined means the workout isn't read yet; null,
 * that it's no split day.
 */
export function usePreviousExercises(
  userId: string | undefined,
  splitDayId: string | null | undefined,
): PreviousExercisesState {
  const [groups, setGroups] = useState<PreviousMuscleGroup[] | null>(null);
  const [dayGroups, setDayGroups] = useState<MuscleGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setGroups(null);
    fetchPreviousExercises(userId)
      .then((rows) => {
        if (!cancelled) setGroups(previousByMuscleGroup(rows, userId));
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, attempt]);

  useEffect(() => {
    if (splitDayId === undefined) return;
    if (splitDayId === null) {
      setDayGroups([]);
      return;
    }
    let cancelled = false;
    setDayGroups(null);
    fetchSplitDayMuscleGroups(splitDayId)
      .then((found) => {
        if (!cancelled) setDayGroups(found);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [splitDayId, attempt]);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((n) => n + 1);
  }, []);

  return {
    status: failed ? 'error' : groups === null || dayGroups === null ? 'loading' : 'ready',
    groups: groups ?? [],
    dayGroups: dayGroups ?? [],
    retry,
  };
}
