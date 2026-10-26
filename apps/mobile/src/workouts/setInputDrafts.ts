import type { MeasurementType } from '../exercises/movementTypes';
import { formatDuration, parseDuration } from '../lib/duration';
import { formatWeightKg, isValidWeightIncrement, roundWeight, toKg } from '../lib/units';
import { bestLoggedSet, formatSetValues } from './setValues';
import { formatShortDate } from './workoutFormat';
import type {
  ExerciseCardSet,
  PreviousSessionDisplay,
  UnilateralExerciseCardSet,
} from './ExerciseCard';
import type { SetRecord, SetSide } from './workoutQueries';

// The set-entry rules every live workout shares: what counts as a valid draft, what a new
// set starts with, how a unilateral exercise groups its two sides, and how last session is
// shown. The regular Active Workout and the group workout both read from here so they cannot
// drift apart.
//
// Each rule follows what the exercise measures: a weight and reps, reps only (bodyweight), or
// a duration (timed), typed as seconds or minutes:seconds. The type defaults to weight and
// reps, as every exercise was before measurement types.

export interface SetInputDraft {
  weight: string;
  reps: string;
  /** A timed set's duration as typed ("45", "1:30"). Absent for every other set. */
  duration?: string;
}

/** What a draft saves as, for updateSet: only the values the type records, the rest null. */
export interface SetDraftValues {
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

/** Every set from the user's last completed session with this exercise, in
 * the order they were logged -- never just the heaviest one. */
export function buildPreviousSessionDisplay(
  previous: { performedAt: string; sets: SetRecord[] } | undefined,
  unit: 'kg' | 'lb',
  type: MeasurementType = 'weight_reps',
): PreviousSessionDisplay | null {
  if (!previous || previous.sets.length === 0) return null;
  const top = bestLoggedSet(previous.sets, type);
  return {
    dateDisplay: formatShortDate(previous.performedAt),
    topSetDisplay: top ? formatSetValues({ ...top, measurementType: type }, unit) : null,
    topSetNumber: top ? previous.sets.indexOf(top) + 1 : null,
    sets: previous.sets.map((s, i) => ({
      setNumber: i + 1,
      weightDisplay: type === 'weight_reps' ? formatWeightKg(s.weightKg ?? 0, unit) : '',
      unit,
      reps: type === 'timed' ? 0 : (s.reps ?? 0),
      durationDisplay:
        type === 'timed' && s.durationSeconds != null ? formatDuration(s.durationSeconds) : null,
      side: s.side,
    })),
  };
}

function isValidReps(text: string): boolean {
  const reps = Number(text);
  return text.trim() !== '' && Number.isInteger(reps) && reps > 0;
}

/**
 * Pairs a unilateral exercise's flat sets into one row per logical set (left + right sharing a
 * setIndex) -- only pairs where both sides are present, in set order.
 */
export function groupUnilateralSets<T extends { setIndex: number; side: 'left' | 'right' | null }>(
  sets: T[],
): { setIndex: number; left: T; right: T }[] {
  const bySetIndex = new Map<number, { left?: T; right?: T }>();
  for (const set of sets) {
    if (set.side !== 'left' && set.side !== 'right') continue;
    const entry = bySetIndex.get(set.setIndex) ?? {};
    entry[set.side] = set;
    bySetIndex.set(set.setIndex, entry);
  }
  const rows: { setIndex: number; left: T; right: T }[] = [];
  for (const [setIndex, { left, right }] of bySetIndex) {
    if (!left || !right) continue;
    rows.push({ setIndex, left, right });
  }
  return rows.sort((a, b) => a.setIndex - b.setIndex);
}

export function isValidDraft(
  draft: SetInputDraft | undefined,
  type: MeasurementType = 'weight_reps',
): boolean {
  if (!draft) return false;
  switch (type) {
    case 'bodyweight':
      return isValidReps(draft.reps);
    case 'timed':
      return parseDuration(draft.duration ?? '') !== null;
    default: {
      const weightNum = Number(draft.weight);
      return (
        draft.weight.trim() !== '' &&
        Number.isFinite(weightNum) &&
        weightNum > 0 &&
        isValidWeightIncrement(weightNum) &&
        isValidReps(draft.reps)
      );
    }
  }
}

/** What to say when a set can't be completed yet, by what it measures. */
export function invalidDraftMessage(type: MeasurementType, bothSides = false): string {
  const sides = bothSides ? ' for both sides' : '';
  switch (type) {
    case 'bodyweight':
      return `Enter a rep count${sides}`;
    case 'timed':
      return `Enter a time${sides}, like 45 or 1:30`;
    default:
      return `Enter a valid weight (in steps of 0.25) and rep count${sides}`;
  }
}

/** A bilateral exercise's sets as ExerciseCard shows them: what's typed, and whether each can be completed. */
export function computeCardSets(
  sets: SetRecord[],
  setInputs: Record<string, SetInputDraft>,
  type: MeasurementType = 'weight_reps',
): ExerciseCardSet[] {
  return sets.map((set) => ({
    id: set.id,
    setIndex: set.setIndex,
    weight: setInputs[set.id]?.weight ?? '',
    reps: setInputs[set.id]?.reps ?? '',
    duration: setInputs[set.id]?.duration ?? '',
    completed: set.completedAt !== null,
    canComplete: isValidDraft(setInputs[set.id], type),
  }));
}

/** The values a valid draft saves as. Call only after isValidDraft. */
export function draftValues(
  draft: SetInputDraft,
  type: MeasurementType,
  unit: 'kg' | 'lb',
): SetDraftValues {
  switch (type) {
    case 'bodyweight':
      return { weightKg: null, reps: Math.trunc(Number(draft.reps)), durationSeconds: null };
    case 'timed':
      return { weightKg: null, reps: null, durationSeconds: parseDuration(draft.duration ?? '') };
    default:
      return {
        weightKg: roundWeight(toKg(Number(draft.weight), unit)),
        reps: Math.trunc(Number(draft.reps)),
        durationSeconds: null,
      };
  }
}

/** What a saved set shows in its fields. */
export function draftFromSet(
  set: Pick<SetRecord, 'weightKg' | 'reps' | 'durationSeconds'>,
  type: MeasurementType,
  unit: 'kg' | 'lb',
): SetInputDraft {
  switch (type) {
    case 'bodyweight':
      return { weight: '', reps: set.reps !== null ? String(set.reps) : '' };
    case 'timed':
      return {
        weight: '',
        reps: '',
        duration: set.durationSeconds != null ? formatDuration(set.durationSeconds) : '',
      };
    default:
      return {
        weight: set.weightKg !== null ? formatWeightKg(set.weightKg, unit) : '',
        reps: set.reps !== null ? String(set.reps) : '',
      };
  }
}

/** Whether anything is typed into a draft. */
export function hasDraftInput(draft: SetInputDraft | undefined): draft is SetInputDraft {
  return (
    draft !== undefined &&
    (draft.weight !== '' || draft.reps !== '' || (draft.duration ?? '') !== '')
  );
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
  type: MeasurementType = 'weight_reps',
): Record<string, SetInputDraft> {
  const next = { ...setInputs };
  for (const set of newSets) {
    if (hasDraftInput(setInputs[set.id])) continue;
    next[set.id] = prefillFor(set.side, setsBefore, setInputs, lastSession, unit, type);
  }
  return next;
}

function prefillFor(
  side: SetSide,
  setsBefore: SetRecord[],
  setInputs: Record<string, SetInputDraft>,
  lastSession: SetRecord[] | undefined,
  unit: 'kg' | 'lb',
  type: MeasurementType,
): SetInputDraft {
  const onSide = (set: SetRecord) => side === null || set.side === side;
  const before = setsBefore
    .filter(onSide)
    .reduce<SetRecord | undefined>(
      (latest, set) => (latest && latest.setIndex > set.setIndex ? latest : set),
      undefined,
    );
  const beforeInput = before ? setInputs[before.id] : undefined;
  if (hasDraftInput(beforeInput)) return { ...beforeInput };

  // Set numbers count a left/right pair as one set, in the order the sets were logged.
  const setNumber = new Set(setsBefore.map((set) => set.setIndex)).size + 1;
  const lastIndexes = Array.from(new Set((lastSession ?? []).map((set) => set.setIndex))).sort(
    (a, b) => a - b,
  );
  const match = lastSession?.find(
    (set) => set.setIndex === lastIndexes[setNumber - 1] && onSide(set),
  );
  return match ? draftFromSet(match, type, unit) : draftFromSet(EMPTY_SET, type, unit);
}

const EMPTY_SET = { weightKg: null, reps: null, durationSeconds: null };

/** Groups a unilateral exercise's flat sets array into one row per LOGICAL
 * set (left + right sharing a setIndex), for ExerciseCard's unilateralSets
 * prop. Only setIndexes with both sides present render -- handleAddSet/
 * handleSelectExercise always create both together, so an incomplete pair
 * would only ever mean a still-in-flight request. */
export function computeUnilateralSets(
  sets: SetRecord[],
  setInputs: Record<string, SetInputDraft>,
  type: MeasurementType = 'weight_reps',
): UnilateralExerciseCardSet[] {
  const bySetIndex = new Map<number, { left?: SetRecord; right?: SetRecord }>();
  for (const set of sets) {
    if (set.side !== 'left' && set.side !== 'right') continue;
    const entry = bySetIndex.get(set.setIndex) ?? {};
    entry[set.side] = set;
    bySetIndex.set(set.setIndex, entry);
  }

  const side = (set: SetRecord) => ({
    id: set.id,
    weight: setInputs[set.id]?.weight ?? '',
    reps: setInputs[set.id]?.reps ?? '',
    duration: setInputs[set.id]?.duration ?? '',
    completed: set.completedAt !== null,
    canComplete: isValidDraft(setInputs[set.id], type),
  });

  const rows: UnilateralExerciseCardSet[] = [];
  for (const [setIndex, { left, right }] of bySetIndex) {
    if (!left || !right) continue;
    rows.push({ setIndex, left: side(left), right: side(right) });
  }
  return rows.sort((a, b) => a.setIndex - b.setIndex);
}
