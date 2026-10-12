import { formatWeightKg, isValidWeightIncrement } from '../lib/units';
import { formatShortDate } from './workoutFormat';
import type { PreviousSessionDisplay, UnilateralExerciseCardSet } from './ExerciseCard';
import type { SetRecord, SetSide } from './workoutQueries';

// The set-entry rules every live workout shares: what counts as a valid draft, what a new
// set starts with, how a unilateral exercise groups its two sides, and how last session is
// shown. The regular Active Workout and the group workout both read from here so they cannot
// drift apart.

export interface SetInputDraft {
  weight: string;
  reps: string;
}

/** Every set from the user's last completed session with this exercise, in
 * the order they were logged -- never just the heaviest one. */
export function buildPreviousSessionDisplay(
  previous: { performedAt: string; sets: SetRecord[] } | undefined,
  unit: 'kg' | 'lb',
): PreviousSessionDisplay | null {
  if (!previous || previous.sets.length === 0) return null;
  return {
    dateDisplay: formatShortDate(previous.performedAt),
    sets: previous.sets.map((s, i) => ({
      setNumber: i + 1,
      weightDisplay: formatWeightKg(s.weightKg ?? 0, unit),
      unit,
      reps: s.reps ?? 0,
      side: s.side,
    })),
  };
}

export function isValidDraft(draft: SetInputDraft | undefined): boolean {
  if (!draft) return false;
  const weightNum = Number(draft.weight);
  const repsNum = Number(draft.reps);
  return (
    Number.isFinite(weightNum) &&
    weightNum > 0 &&
    isValidWeightIncrement(weightNum) &&
    Number.isInteger(repsNum) &&
    repsNum > 0
  );
}

function hasInput(draft: SetInputDraft | undefined): draft is SetInputDraft {
  return draft !== undefined && (draft.weight !== '' || draft.reps !== '');
}

/**
 * The inputs with each new set filled in as editable values: a copy of the set before it in
 * this workout when that set has anything in it, otherwise the same set number from last
 * session. A unilateral exercise fills each side from the same side. A set that already has
 * something typed in it is left alone. Filling never completes a set: that still takes a tap.
 */
export function withPrefilledSets(
  setInputs: Record<string, SetInputDraft>,
  newSets: SetRecord[],
  setsBefore: SetRecord[],
  lastSession: SetRecord[] | undefined,
  unit: 'kg' | 'lb',
): Record<string, SetInputDraft> {
  const next = { ...setInputs };
  for (const set of newSets) {
    if (hasInput(setInputs[set.id])) continue;
    next[set.id] = prefillFor(set.side, setsBefore, setInputs, lastSession, unit);
  }
  return next;
}

function prefillFor(
  side: SetSide,
  setsBefore: SetRecord[],
  setInputs: Record<string, SetInputDraft>,
  lastSession: SetRecord[] | undefined,
  unit: 'kg' | 'lb',
): SetInputDraft {
  const onSide = (set: SetRecord) => side === null || set.side === side;
  const before = setsBefore
    .filter(onSide)
    .reduce<SetRecord | undefined>(
      (latest, set) => (latest && latest.setIndex > set.setIndex ? latest : set),
      undefined,
    );
  const beforeInput = before ? setInputs[before.id] : undefined;
  if (hasInput(beforeInput)) return { ...beforeInput };

  // Set numbers count a left/right pair as one set, in the order the sets were logged.
  const setNumber = new Set(setsBefore.map((set) => set.setIndex)).size + 1;
  const lastIndexes = Array.from(new Set((lastSession ?? []).map((set) => set.setIndex))).sort(
    (a, b) => a - b,
  );
  const match = lastSession?.find(
    (set) => set.setIndex === lastIndexes[setNumber - 1] && onSide(set),
  );
  return {
    weight: match?.weightKg != null ? formatWeightKg(match.weightKg, unit) : '',
    reps: match?.reps != null ? String(match.reps) : '',
  };
}

/** Groups a unilateral exercise's flat sets array into one row per LOGICAL
 * set (left + right sharing a setIndex), for ExerciseCard's unilateralSets
 * prop. Only setIndexes with both sides present render -- handleAddSet/
 * handleSelectExercise always create both together, so an incomplete pair
 * would only ever mean a still-in-flight request. */
export function computeUnilateralSets(
  sets: SetRecord[],
  setInputs: Record<string, SetInputDraft>,
): UnilateralExerciseCardSet[] {
  const bySetIndex = new Map<number, { left?: SetRecord; right?: SetRecord }>();
  for (const set of sets) {
    if (set.side !== 'left' && set.side !== 'right') continue;
    const entry = bySetIndex.get(set.setIndex) ?? {};
    entry[set.side] = set;
    bySetIndex.set(set.setIndex, entry);
  }

  const rows: UnilateralExerciseCardSet[] = [];
  for (const [setIndex, { left, right }] of bySetIndex) {
    if (!left || !right) continue;
    rows.push({
      setIndex,
      left: {
        id: left.id,
        weight: setInputs[left.id]?.weight ?? '',
        reps: setInputs[left.id]?.reps ?? '',
        completed: left.completedAt !== null,
        canComplete: isValidDraft(setInputs[left.id]),
      },
      right: {
        id: right.id,
        weight: setInputs[right.id]?.weight ?? '',
        reps: setInputs[right.id]?.reps ?? '',
        completed: right.completedAt !== null,
        canComplete: isValidDraft(setInputs[right.id]),
      },
    });
  }
  return rows.sort((a, b) => a.setIndex - b.setIndex);
}
