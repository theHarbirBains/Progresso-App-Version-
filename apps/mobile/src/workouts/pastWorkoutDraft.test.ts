import { act, renderHook } from '@testing-library/react-native';
import type { ExerciseRow } from '../exercises/exerciseQueries';
import {
  completedAtFor,
  dateKeyToLocalDate,
  detailsProblem,
  setsToSave,
  usePastWorkoutDate,
  usePastWorkoutDraft,
  type PastDraftExercise,
  type PastDraftSet,
} from './pastWorkoutDraft';

function draftSet(setIndex: number, extra: Partial<PastDraftSet> = {}): PastDraftSet {
  return {
    localId: `s-${setIndex}-${extra.side ?? 'none'}`,
    id: null,
    setIndex,
    side: null,
    weight: '',
    reps: '',
    duration: '',
    ...extra,
  };
}

function exercise(extra: Partial<PastDraftExercise>): PastDraftExercise {
  return {
    localId: 'ex-1',
    id: null,
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
    measurementType: 'weight_reps',
    sets: [],
    ...extra,
  };
}

const bench = {
  id: 'bench',
  name: 'Bench Press',
  muscleGroup: 'chest',
  movementType: 'bilateral',
  measurementType: 'weight_reps',
} as unknown as ExerciseRow;

describe('setsToSave', () => {
  it('keeps only the sets filled in', () => {
    const done = draftSet(1, { weight: '100', reps: '8' });
    const blank = draftSet(2);

    expect(setsToSave(exercise({ sets: [done, blank] }))).toEqual([done]);
  });

  it("keeps a unilateral exercise's set only where both sides are filled in", () => {
    const left = draftSet(1, { side: 'left', weight: '20', reps: '10' });
    const right = draftSet(1, { side: 'right', weight: '20', reps: '10' });
    const leftOnly = draftSet(2, { side: 'left', weight: '20', reps: '10' });
    const blankRight = draftSet(2, { side: 'right' });

    expect(
      setsToSave(
        exercise({ movementType: 'unilateral', sets: [left, right, leftOnly, blankRight] }),
      ),
    ).toEqual([left, right]);
  });
});

describe('dateKeyToLocalDate', () => {
  it('is noon that day, local time', () => {
    const date = dateKeyToLocalDate('2026-10-05');

    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 9, 5, 12,
    ]);
  });
});

describe('detailsProblem', () => {
  it('needs a name and a day that has already happened', () => {
    const today = new Date();
    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 12);

    expect(detailsProblem('  ', today)).toBe('Enter a name for this workout');
    expect(detailsProblem('Push', tomorrow)).toBe("Pick a date that's already happened");
    expect(detailsProblem('Push', today)).toBeNull();
  });
});

describe('completedAtFor', () => {
  it('is the start plus the duration typed, and nothing with none', () => {
    const start = new Date('2026-10-05T12:00:00.000Z');

    expect(completedAtFor(start, '1', '30')).toBe('2026-10-05T13:30:00.000Z');
    expect(completedAtFor(start, '', '45')).toBe('2026-10-05T12:45:00.000Z');
    expect(completedAtFor(start, '', '')).toBeUndefined();
    expect(completedAtFor(start, '0', '0')).toBeUndefined();
  });
});

describe('usePastWorkoutDraft', () => {
  it('adds an exercise with one blank set, adds and removes sets, and changes what they say', () => {
    const { result } = renderHook(() => usePastWorkoutDraft());

    act(() => result.current.addExercise(bench));
    const [added] = result.current.exercises;
    expect(added).toMatchObject({ localId: 'local-1', id: null, exerciseId: 'bench' });
    expect(added.sets).toEqual([draftSet(1, { localId: 'local-2' })]);

    act(() => result.current.addSet(added));
    expect(result.current.exercises[0].sets.map((s) => s.setIndex)).toEqual([1, 2]);

    act(() => result.current.changeSet('local-1', 'local-2', 'weight', '100'));
    expect(result.current.exercises[0].sets[0].weight).toBe('100');

    act(() => result.current.removeSet('local-1', 'local-2'));
    expect(result.current.exercises[0].sets.map((s) => s.setIndex)).toEqual([2]);

    act(() => result.current.removeExercise('local-1'));
    expect(result.current.exercises).toEqual([]);
  });

  it('gives a unilateral exercise a left and a right side per set, removed together', () => {
    const { result } = renderHook(() => usePastWorkoutDraft());

    act(() => result.current.addExercise({ ...bench, movementType: 'unilateral' }));
    expect(result.current.exercises[0].sets.map((s) => s.side)).toEqual(['left', 'right']);

    act(() => result.current.removeUnilateralSet('local-1', 1));
    expect(result.current.exercises[0].sets).toEqual([]);
  });
});

describe('usePastWorkoutDate', () => {
  it("shows a saved workout's day and month, moves the month, and closes on a day picked", () => {
    const { result } = renderHook(() => usePastWorkoutDate());

    act(() => result.current.show(new Date(2026, 0, 15, 9)));
    expect([result.current.calendarYear, result.current.calendarMonth]).toEqual([2026, 1]);

    act(() => result.current.moveMonth(-1));
    expect([result.current.calendarYear, result.current.calendarMonth]).toEqual([2025, 12]);

    act(() => result.current.openPicker());
    expect(result.current.pickerOpen).toBe(true);
    act(() => result.current.pick('2025-12-24'));
    expect(result.current.pickerOpen).toBe(false);
    expect(result.current.date.getDate()).toBe(24);
    expect(result.current.date.getHours()).toBe(12);
  });
});
