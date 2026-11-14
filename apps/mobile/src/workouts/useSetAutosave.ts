import { useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import type { MeasurementType } from '../exercises/movementTypes';
import { formatDuration } from '../lib/duration';
import { draftValues, isValidDraft, type SetInputDraft } from './setInputDrafts';
import { stopSetTimer } from './setTimers';
import type { SetRecord } from './workoutQueries';

// A live workout's sets save as they're typed -- no check to tap. Once a set's fields hold what
// its exercise records (weight and reps, reps, or a time), it's saved as done a moment after the
// typing stops, and saved again whenever it's changed; emptied, it's reopened. Only what the
// person types (or a timer they pause) starts a save -- a new set starts empty, never filled in
// for them. At Finish (readyToFinish) a timer still going stops, any set left with an empty
// field is asked about -- fill it in, or remove it -- and everything still on the screen is
// saved.

/** How long after the last keystroke a set saves. */
export const AUTOSAVE_DELAY_MS = 700;

export interface LiveSet {
  set: SetRecord;
  /** What its exercise records. */
  type: MeasurementType;
  /** Its exercise, and whether that's done one side at a time: both sides go together. */
  exerciseId: string;
  unilateral: boolean;
}

export interface SetSave {
  weightKg?: number | null;
  reps?: number | null;
  durationSeconds?: number | null;
  completedAt: string | null;
}

interface Options {
  /** Every set on the screen. */
  sets: LiveSet[];
  setInputs: Record<string, SetInputDraft>;
  weightUnit: 'kg' | 'lb';
  /** Saves one set, returning it as saved. */
  save: (setId: string, update: SetSave) => Promise<SetRecord>;
  /** The set as saved, for the screen's own copy. */
  onSaved: (set: SetRecord) => void;
  /** Removes sets left empty at Finish, and drops them from the screen's own copy. */
  remove: (setIds: string[]) => Promise<void>;
  /** Puts stopped timers' times into the typed drafts, so they show. */
  onTimersStopped: (drafts: Record<string, SetInputDraft>) => void;
  onError: (message: string) => void;
  delayMs?: number;
}

/** What saving `draft` would change on `set`, or null when nothing would. */
export function setSaveFor(
  set: SetRecord,
  draft: SetInputDraft | undefined,
  type: MeasurementType,
  unit: 'kg' | 'lb',
  now: () => string = () => new Date().toISOString(),
): SetSave | null {
  if (!isValidDraft(draft, type)) {
    // Emptied (or not a value yet): a saved set reopens; an open one stays as it is.
    return set.completedAt ? { completedAt: null } : null;
  }
  const values = draftValues(draft!, type, unit);
  const same =
    set.completedAt !== null &&
    set.weightKg === values.weightKg &&
    set.reps === values.reps &&
    (set.durationSeconds ?? null) === values.durationSeconds;
  if (same) return null;
  return { ...values, completedAt: set.completedAt ?? now() };
}

/** The sets on the screen with a field still empty (or not a value): they're asked about at Finish. */
export function unfilledSets(sets: LiveSet[], setInputs: Record<string, SetInputDraft>): LiveSet[] {
  return sets.filter(({ set, type }) => !isValidDraft(setInputs[set.id], type));
}

/** The sets to remove for those left empty: a one-side-at-a-time set's other side too. */
export function setIdsToRemove(sets: LiveSet[], unfilled: LiveSet[]): string[] {
  const ids = new Set<string>();
  for (const empty of unfilled) {
    ids.add(empty.set.id);
    if (!empty.unilateral) continue;
    for (const other of sets) {
      if (other.exerciseId === empty.exerciseId && other.set.setIndex === empty.set.setIndex) {
        ids.add(other.set.id);
      }
    }
  }
  return Array.from(ids);
}

/** Finish's question about sets left empty: 'remove' them and finish, or 'fill' them in first. */
export function askAboutEmptySets(count: number): Promise<'fill' | 'remove'> {
  const one = count === 1;
  return new Promise((resolve) => {
    Alert.alert(
      one ? 'A set is missing a value' : 'Some sets are missing values',
      `${one ? 'One set has' : `${count} sets have`} an empty weight, reps or time. Fill ${
        one ? 'it' : 'them'
      } in, or remove ${one ? 'it' : 'them'} and finish.`,
      [
        { text: 'Fill In', style: 'cancel', onPress: () => resolve('fill') },
        {
          text: one ? 'Remove It and Finish' : 'Remove Them and Finish',
          style: 'destructive',
          onPress: () => resolve('remove'),
        },
      ],
      { cancelable: true, onDismiss: () => resolve('fill') },
    );
  });
}

export function useSetAutosave({
  sets,
  setInputs,
  weightUnit,
  save,
  onSaved,
  remove,
  onTimersStopped,
  onError,
  delayMs = AUTOSAVE_DELAY_MS,
}: Options) {
  // Read at save time, so a save always goes by what's on the screen then.
  const latest = useRef({
    sets,
    setInputs,
    weightUnit,
    save,
    onSaved,
    remove,
    onTimersStopped,
    onError,
  });
  latest.current = { sets, setInputs, weightUnit, save, onSaved, remove, onTimersStopped, onError };
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // One save at a time per set, in the order asked: a later one waits for the one before.
  const inFlight = useRef(new Map<string, Promise<void>>());
  const seen = useRef<Record<string, SetInputDraft>>({});

  const saveSet = useCallback((setId: string, inputs?: Record<string, SetInputDraft>) => {
    const pending = timers.current.get(setId);
    if (pending) clearTimeout(pending);
    timers.current.delete(setId);
    const before = inFlight.current.get(setId) ?? Promise.resolve();
    const next = before.then(async () => {
      const now = latest.current;
      const live = now.sets.find((entry) => entry.set.id === setId);
      if (!live) return;
      const update = setSaveFor(
        live.set,
        (inputs ?? now.setInputs)[setId],
        live.type,
        now.weightUnit,
      );
      if (!update) return;
      try {
        now.onSaved(await now.save(setId, update));
      } catch (err) {
        now.onError(err instanceof Error ? err.message : 'That set did not save');
      }
    });
    inFlight.current.set(setId, next);
    return next;
  }, []);

  // A changed draft saves a moment after the typing stops. A set seen for the first time --
  // loaded, or just added with values filled in for it -- isn't a change by the person.
  useEffect(() => {
    for (const [setId, draft] of Object.entries(setInputs)) {
      const before = seen.current[setId];
      seen.current[setId] = draft;
      if (before === undefined || before === draft) continue;
      const pending = timers.current.get(setId);
      if (pending) clearTimeout(pending);
      timers.current.set(
        setId,
        setTimeout(() => void saveSet(setId), delayMs),
      );
    }
  }, [setInputs, saveSet, delayMs]);

  // Leaving the screen drops the waits; what's typed stays on the device (the live drafts).
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  /**
   * Gets the sets on the screen ready to finish the workout: a timer still going stops, its time
   * the set's; a set left with an empty field is asked about -- removed (both sides of a
   * one-side-at-a-time set), or Finish is called off for it to be filled in; and everything else
   * on the screen is saved, values filled in for the person included. Resolves whether to finish.
   */
  const readyToFinish = useCallback(async (): Promise<boolean> => {
    const now = latest.current;
    const stopped: Record<string, SetInputDraft> = {};
    for (const { set, type } of now.sets) {
      if (type !== 'timed') continue;
      const seconds = stopSetTimer(set.id);
      if (seconds !== null) {
        stopped[set.id] = {
          ...(now.setInputs[set.id] ?? { weight: '', reps: '' }),
          duration: formatDuration(seconds),
        };
      }
    }
    if (Object.keys(stopped).length > 0) now.onTimersStopped(stopped);

    const inputs = { ...now.setInputs, ...stopped };
    const unfilled = unfilledSets(now.sets, inputs);
    if (unfilled.length > 0 && (await askAboutEmptySets(unfilled.length)) === 'fill') return false;

    const removing = new Set(setIdsToRemove(now.sets, unfilled));
    await Promise.all(
      now.sets.filter(({ set }) => !removing.has(set.id)).map(({ set }) => saveSet(set.id, inputs)),
    );
    if (removing.size > 0) await now.remove(Array.from(removing));
    return true;
  }, [saveSet]);

  return { readyToFinish };
}
