import { formatWeightKg, isValidWeightIncrement } from '../lib/units';
import { formatShortDate } from './workoutFormat';
import type { PreviousSessionDisplay, UnilateralExerciseCardSet } from './ExerciseCard';
import type { SetRecord } from './workoutQueries';

// The set-entry rules every live workout shares: what counts as a valid draft, how a
// unilateral exercise groups its two sides, and how last session is shown. The regular
// Active Workout and the group workout both read from here so they cannot drift apart.

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
