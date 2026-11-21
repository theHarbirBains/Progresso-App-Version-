import { useRef, useState } from 'react';
import { addMonths, toLocalDateKey } from '../design/calendarGrid';
import type { CardioValues } from '../cardio/cardioActivities';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import type { MuscleGroup } from '../exercises/muscleGroups';
import {
  measurementTypeOf,
  type MeasurementType,
  type MovementType,
} from '../exercises/movementTypes';
import { dropSetSlot, rowsRemovedWith, type DropSetRow } from './dropSets';
import { groupUnilateralSets, isValidDraft } from './setInputDrafts';

// What Log a Past Workout and Edit Workout type in: a workout's exercises and
// sets as text, and the day it happened. Nothing here saves -- each screen
// saves the draft its own way (a new workout all at once, or the changes to a
// saved one).

/** A set as typed. */
export interface PastDraftSet {
  localId: string;
  /** The saved set's id, or null for a row not saved yet. */
  id: string | null;
  setIndex: number;
  side: 'left' | 'right' | null;
  weight: string;
  reps: string;
  /** A timed set's duration as typed. */
  duration: string;
  /** A warm-up: saved with the workout, counted toward nothing. */
  isWarmup?: boolean;
  /** A drop set: part of the working set before it (dropSets.ts). */
  isDrop?: boolean;
}

export interface PastDraftExercise {
  localId: string;
  /** The saved workout_exercises id, or null for an exercise not saved yet. */
  id: string | null;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  movementType: MovementType;
  /** What the exercise is logged as: weight and reps, reps only, or a time. */
  measurementType: MeasurementType;
  sets: PastDraftSet[];
}

export type PastSetField = 'weight' | 'reps' | 'duration';

/** A cardio activity as typed in: its figures, and the saved row's id (null until saved). */
export interface PastDraftCardio extends CardioValues {
  localId: string;
  id: string | null;
}

/**
 * The sets worth saving: only those filled in -- a past workout is typed in one sitting, so a
 * stray blank "Set 3" is just something not got to, not an error -- and, for a unilateral
 * exercise, only where both sides are.
 */
export function setsToSave(exercise: PastDraftExercise): PastDraftSet[] {
  const valid = exercise.sets.filter((set) => isValidDraft(set, exercise.measurementType));
  return exercise.movementType === 'unilateral'
    ? groupUnilateralSets(valid).flatMap((pair) => [pair.left, pair.right])
    : valid;
}

/**
 * A picked calendar day, at noon rather than midnight -- comfortably clear of any local
 * timezone's day boundary. A workout's completedAt is this instant plus the duration typed; with
 * none it equals performedAt, which every duration readout shows as "--", never a made-up one.
 */
export function dateKeyToLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

/** Why the workout's name or date can't be saved, or null when they can. */
export function detailsProblem(name: string, date: Date): string | null {
  if (!name.trim()) return 'Enter a name for this workout';
  if (toLocalDateKey(date) > toLocalDateKey(new Date()))
    return "Pick a date that's already happened";
  return null;
}

/**
 * When the workout finished: its date plus the duration typed. With none typed, undefined -- a
 * workout saved without one ends as it starts (completedAt = performedAt, createLoggedWorkout's
 * default), which every duration readout shows as "--", never a made-up "0 min".
 */
export function completedAtFor(date: Date, hours: string, minutes: string): string | undefined {
  const totalMinutes = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
  return totalMinutes > 0
    ? new Date(date.getTime() + totalMinutes * 60000).toISOString()
    : undefined;
}

/** The exercises and sets being typed in, and every change the page can make to them. */
export function usePastWorkoutDraft() {
  const [exercises, setExercises] = useState<PastDraftExercise[]>([]);
  const [cardio, setCardio] = useState<PastDraftCardio[]>([]);
  const nextLocalId = useRef(0);

  function newLocalId(): string {
    nextLocalId.current += 1;
    return `local-${nextLocalId.current}`;
  }

  function blankSets(movementType: MovementType, setIndex: number): PastDraftSet[] {
    const blank = (side: PastDraftSet['side']): PastDraftSet => ({
      localId: newLocalId(),
      id: null,
      setIndex,
      side,
      weight: '',
      reps: '',
      duration: '',
    });
    return movementType === 'unilateral' ? [blank('left'), blank('right')] : [blank(null)];
  }

  function changeExercise(
    localId: string,
    change: (exercise: PastDraftExercise) => PastDraftExercise,
  ) {
    setExercises((prev) => prev.map((ex) => (ex.localId === localId ? change(ex) : ex)));
  }

  /** An exercise's sets in order, one entry per logical set (a unilateral set's two sides together). */
  function logicalSets(exercise: PastDraftExercise): PastDraftSet[][] {
    if (exercise.movementType === 'unilateral') {
      return groupUnilateralSets(exercise.sets).map(({ left, right }) => [left, right]);
    }
    return [...exercise.sets].sort((a, b) => a.setIndex - b.setIndex).map((set) => [set]);
  }

  /** Removes a set -- with the drop sets under it, which are part of it. */
  function removeLogicalSet(exercise: PastDraftExercise, matches: (set: PastDraftSet) => boolean) {
    const groups = logicalSets(exercise);
    const position = groups.findIndex((group) => group.some(matches));
    if (position < 0) return;
    const gone = new Set(
      rowsRemovedWith(
        groups.map((group) => ({ rows: group, isDrop: group[0].isDrop })),
        position,
      ).flatMap((entry) => entry.rows.map((set) => set.localId)),
    );
    changeExercise(exercise.localId, (ex) => ({
      ...ex,
      sets: ex.sets.filter((s) => !gone.has(s.localId)),
    }));
  }

  return {
    exercises,
    /** Replaces every exercise -- a saved workout's, as it loads. */
    setExercises,
    /** Its cardio, in the order added -- kept apart from the exercises and their sets. */
    cardio,
    /** Replaces the cardio -- a saved workout's, as it loads. */
    setCardio,
    addCardio(values: CardioValues) {
      setCardio((prev) => [...prev, { ...values, localId: newLocalId(), id: null }]);
    },
    changeCardio(localId: string, values: CardioValues) {
      setCardio((prev) => prev.map((c) => (c.localId === localId ? { ...c, ...values } : c)));
    },
    removeCardio(localId: string) {
      setCardio((prev) => prev.filter((c) => c.localId !== localId));
    },
    newLocalId,
    addExercise(exercise: ExerciseRow) {
      setExercises((prev) => [
        ...prev,
        {
          localId: newLocalId(),
          id: null,
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          muscleGroup: exercise.muscleGroup,
          movementType: exercise.movementType,
          measurementType: measurementTypeOf(exercise),
          sets: blankSets(exercise.movementType, 1),
        },
      ]);
    },
    removeExercise(localId: string) {
      setExercises((prev) => prev.filter((ex) => ex.localId !== localId));
    },
    addSet(exercise: PastDraftExercise) {
      const nextIndex = exercise.sets.reduce((max, s) => Math.max(max, s.setIndex), 0) + 1;
      const newSets = blankSets(exercise.movementType, nextIndex);
      changeExercise(exercise.localId, (ex) => ({ ...ex, sets: [...ex.sets, ...newSets] }));
    },
    /** Removes a set, and the drop sets under it. */
    removeSet(exercise: PastDraftExercise, setLocalId: string) {
      removeLogicalSet(exercise, (s) => s.localId === setLocalId);
    },
    /** Removes both sides of a unilateral exercise's set, and the drop sets under it. */
    removeUnilateralSet(exercise: PastDraftExercise, setIndex: number) {
      removeLogicalSet(exercise, (s) => s.setIndex === setIndex);
    },
    /** Marks a set a warm-up, or a working set again -- a unilateral set's two sides together. */
    toggleWarmup(exerciseLocalId: string, setIndex: number) {
      changeExercise(exerciseLocalId, (ex) => {
        const warmup = !ex.sets.find((s) => s.setIndex === setIndex)?.isWarmup;
        return {
          ...ex,
          sets: ex.sets.map((s) => (s.setIndex === setIndex ? { ...s, isWarmup: warmup } : s)),
        };
      });
    },
    /**
     * A drop set under the last set filled in (and any drops already under it), the sets after it
     * moving down one -- the live workout's Drop Set, typed in.
     */
    addDropSet(exercise: PastDraftExercise) {
      const rows: DropSetRow[] = logicalSets(exercise).map((group) => ({
        setIndex: group[0].setIndex,
        ids: group.map((set) => set.localId),
        isWarmup: group[0].isWarmup,
        isDrop: group[0].isDrop,
        filled: group.every((set) => isValidDraft(set, exercise.measurementType)),
      }));
      const slot = dropSetSlot(rows);
      if (!slot) return;
      const moved = new Map(slot.moves.map((move) => [move.id, move.setIndex]));
      const drops = blankSets(exercise.movementType, slot.setIndex).map((set) => ({
        ...set,
        isDrop: true,
      }));
      changeExercise(exercise.localId, (ex) => ({
        ...ex,
        sets: [
          ...ex.sets.map((s) =>
            moved.has(s.localId) ? { ...s, setIndex: moved.get(s.localId)! } : s,
          ),
          ...drops,
        ].sort((a, b) => a.setIndex - b.setIndex),
      }));
    },
    changeSet(exerciseLocalId: string, setLocalId: string, field: PastSetField, text: string) {
      changeExercise(exerciseLocalId, (ex) => ({
        ...ex,
        sets: ex.sets.map((s) => (s.localId === setLocalId ? { ...s, [field]: text } : s)),
      }));
    },
  };
}

export type PastWorkoutDraft = ReturnType<typeof usePastWorkoutDraft>;

/** The day the workout happened, and its date picker: open or not, and the month it shows. */
export function usePastWorkoutDate() {
  const [date, setDate] = useState(() => new Date());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [calendar, setCalendar] = useState(() => ({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  }));

  return {
    date,
    pickerOpen,
    calendarYear: calendar.year,
    calendarMonth: calendar.month,
    openPicker: () => setPickerOpen(true),
    closePicker: () => setPickerOpen(false),
    /** Shows `day` as the workout's, the picker on its month -- a saved workout's, as it loads. */
    show(day: Date) {
      setDate(day);
      setCalendar({ year: day.getFullYear(), month: day.getMonth() + 1 });
    },
    pick(dateKey: string) {
      setDate(dateKeyToLocalDate(dateKey));
      setPickerOpen(false);
    },
    moveMonth(delta: number) {
      setCalendar((prev) => addMonths(prev.year, prev.month, delta));
    },
  };
}

export type PastWorkoutDate = ReturnType<typeof usePastWorkoutDate>;
