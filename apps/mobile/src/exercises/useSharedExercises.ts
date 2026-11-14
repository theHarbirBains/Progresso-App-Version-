import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { copyExercise, fetchSharedExercises } from '../lib/exercisesApi';
import {
  exerciseRowFromResponse,
  invalidateExerciseCache,
  sharedExerciseRow,
  type ExerciseRow,
} from './exerciseQueries';

/** Nothing shared: one list, so "still nothing" never reads as a change (and a reload). */
const NONE: ExerciseRow[] = [];

export interface SharedExercises {
  /** Every exercise shared with this person; empty until read, or when it can't be. */
  rows: ExerciseRow[];
  /** Why they couldn't be read -- shown on the Friends tab, where they're all there is. */
  error: string | null;
  reload: () => void;
  /**
   * Makes a shared exercise theirs (their own by that name at that gym, or a copy in their
   * library) and returns it; a built-in or their own comes back as it is.
   */
  makeOwn: (exercise: ExerciseRow) => Promise<ExerciseRow>;
}

/**
 * The exercises shared with this person -- their trainer's, their clients', and the people they
 * follow's -- read each time a library or picker opens (`active`), and again after one is made
 * theirs. They change elsewhere (someone else edits theirs), so they're never cached.
 */
export function useSharedExercises(active: boolean): SharedExercises {
  const { user, session } = useAuth();
  const userId = user?.id ?? '';
  const accessToken = session?.access_token;
  const [rows, setRows] = useState<ExerciseRow[]>(NONE);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!active || !accessToken) return;
    let cancelled = false;
    fetchSharedExercises(accessToken)
      .then((shared) => {
        if (cancelled) return;
        setRows(shared.length > 0 ? shared.map(sharedExerciseRow) : NONE);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRows(NONE);
        setError(err instanceof Error ? err.message : 'Could not load shared exercises');
      });
    return () => {
      cancelled = true;
    };
  }, [active, accessToken, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  const makeOwn = useCallback(
    async (exercise: ExerciseRow) => {
      if (!exercise.shared) return exercise;
      if (!accessToken) throw new Error('Please sign in again.');
      const own = exerciseRowFromResponse(await copyExercise(accessToken, exercise.id));
      // It's in their library now: the library's list is read again, and so is what's shared.
      invalidateExerciseCache(userId);
      reload();
      return own;
    },
    [accessToken, userId, reload],
  );

  return { rows, error, reload, makeOwn };
}
