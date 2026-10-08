import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import type { SetInputDraft } from './setInputDrafts';

export interface UseSetInputDraftsResult {
  setInputs: Record<string, SetInputDraft>;
  /** Raw setter, for callers that need more than a single field's weight/reps change --
   * seeding drafts after a load, adding a blank one for a new set, dropping a removed
   * one's entry. */
  setSetInputs: Dispatch<SetStateAction<Record<string, SetInputDraft>>>;
  /** Stable across renders (functional update only), same reasoning as the identical
   * code this replaces in ActiveWorkoutScreen/GroupWorkoutEditor: SetRow's own memo
   * can only skip the rows that didn't change while the user types into one, if the
   * handler it's given never changes identity. */
  changeWeight: (setId: string, text: string) => void;
  changeReps: (setId: string, text: string) => void;
}

/**
 * The one piece of live-set-tracking state that really is identical between
 * ActiveWorkoutScreen (one person's own workout) and GroupWorkoutEditor
 * (several people's workouts, one of them this device's own) -- what's
 * currently typed into each set's weight/reps fields, keyed by set id,
 * before it's valid enough to complete. Everything built on top of this
 * (how it's loaded, when a change is saved, whether it round-trips through
 * a server reload) genuinely differs between those two screens' own data
 * flows, and stays in each of them rather than being forced into one shape
 * here.
 */
export function useSetInputDrafts(): UseSetInputDraftsResult {
  const [setInputs, setSetInputs] = useState<Record<string, SetInputDraft>>({});

  const changeWeight = useCallback(
    (setId: string, text: string) =>
      setSetInputs((prev) => ({
        ...prev,
        [setId]: { weight: text, reps: prev[setId]?.reps ?? '' },
      })),
    [],
  );
  const changeReps = useCallback(
    (setId: string, text: string) =>
      setSetInputs((prev) => ({
        ...prev,
        [setId]: { weight: prev[setId]?.weight ?? '', reps: text },
      })),
    [],
  );

  return { setInputs, setSetInputs, changeWeight, changeReps };
}
