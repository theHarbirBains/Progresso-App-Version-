import { useRef, useState } from 'react';
import { addMonths } from '../design/calendarGrid';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import type { MuscleGroup } from '../exercises/muscleGroups';
import {
  measurementTypeOf,
  type MeasurementType,
  type MovementType,
} from '../exercises/movementTypes';
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

/** The exercises and sets being typed in, and every change the page can make to them. */
export function usePastWorkoutDraft() {
  const [exercises, setExercises] = useState<PastDraftExercise[]>([]);
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

  return {
    exercises,
    /** Replaces every exercise -- a saved workout's, as it loads. */
    setExercises,
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
    removeSet(exerciseLocalId: string, setLocalId: string) {
      changeExercise(exerciseLocalId, (ex) => ({
        ...ex,
        sets: ex.sets.filter((s) => s.localId !== setLocalId),
      }));
    },
    /** Removes both sides of a unilateral exercise's set. */
    removeUnilateralSet(exerciseLocalId: string, setIndex: number) {
      changeExercise(exerciseLocalId, (ex) => ({
        ...ex,
        sets: ex.sets.filter((s) => s.setIndex !== setIndex),
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
