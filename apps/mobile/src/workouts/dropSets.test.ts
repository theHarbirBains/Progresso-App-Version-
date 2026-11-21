import { dropSetSlot, rowsRemovedWith, setLabels, type DropSetRow } from './dropSets';
import { computeTopSets } from '../progress/topSets';
import { topSetProgression } from './exerciseProgress';
import type { HistoricalSetWithExercise } from './exerciseHistoryGrouping';
import { completedSetsOnly } from './setCompletion';
import { bestLoggedSet, loggedSets } from './setValues';
import type { SetRecord } from './workoutQueries';
import { computeTotalSets, computeTotalVolumeKg } from './workoutSummary';

const row = (setIndex: number, extra: Partial<DropSetRow> = {}): DropSetRow => ({
  setIndex,
  ids: [`s${setIndex}`],
  filled: true,
  ...extra,
});

describe('dropSetSlot', () => {
  it('puts a drop under the last set filled in, moving the empty set waiting below down one', () => {
    expect(dropSetSlot([row(1), row(2, { filled: false })])).toEqual({
      setIndex: 2,
      moves: [{ id: 's2', setIndex: 3 }],
    });
  });

  it('stacks drops: a new one goes under the drops already there', () => {
    expect(
      dropSetSlot([row(1), row(2, { isDrop: true }), row(3, { isDrop: true, filled: false })]),
    ).toEqual({ setIndex: 4, moves: [] });
  });

  it('moves nothing when the next place is free (a set removed left a gap)', () => {
    expect(dropSetSlot([row(1), row(3, { filled: false })])).toEqual({ setIndex: 2, moves: [] });
  });

  it('moves both sides of a unilateral set, and every set after', () => {
    expect(
      dropSetSlot([
        row(1, { ids: ['l1', 'r1'] }),
        row(2, { ids: ['l2', 'r2'], filled: false }),
        row(3, { ids: ['l3', 'r3'], filled: false }),
      ])?.moves,
    ).toEqual([
      { id: 'l2', setIndex: 3 },
      { id: 'r2', setIndex: 3 },
      { id: 'l3', setIndex: 4 },
      { id: 'r3', setIndex: 4 },
    ]);
  });

  it('has nowhere to put a drop until a working set is filled in -- a warm-up is not one', () => {
    expect(dropSetSlot([])).toBeNull();
    expect(dropSetSlot([row(1, { filled: false })])).toBeNull();
    expect(dropSetSlot([row(1, { isWarmup: true }), row(2, { filled: false })])).toBeNull();
  });
});

describe('setLabels', () => {
  it('numbers working sets by place, and gives a drop its set’s number and none of its own', () => {
    expect(setLabels([{}, { isDrop: true }, { isDrop: true }, {}])).toEqual([
      { number: 1, drop: false },
      { number: 1, drop: true },
      { number: 1, drop: true },
      { number: 2, drop: false },
    ]);
  });
});

describe('rowsRemovedWith', () => {
  it('takes a working set’s drops with it, and a drop on its own', () => {
    const rows = [{ id: 'a' }, { id: 'b', isDrop: true }, { id: 'c' }, { id: 'd', isDrop: true }];
    expect(rowsRemovedWith(rows, 0).map((r) => r.id)).toEqual(['a', 'b']);
    expect(rowsRemovedWith(rows, 1).map((r) => r.id)).toEqual(['b']);
    expect(rowsRemovedWith(rows, 2).map((r) => r.id)).toEqual(['c', 'd']);
  });
});

describe('what a drop set counts toward', () => {
  const set = (id: string, weightKg: number, reps: number, extra: Partial<SetRecord> = {}) =>
    ({
      id,
      setIndex: 1,
      side: null,
      weightKg,
      reps,
      completedAt: '2026-11-20T10:00:00Z',
      ...extra,
    }) as SetRecord;
  // A drop heavier than its set (a typo, say) still never becomes anything but volume.
  const sets = [set('s1', 100, 8), set('d1', 120, 9, { setIndex: 2, isDrop: true })];

  it('adds its volume, but is never a set of its own or the top set', () => {
    expect(completedSetsOnly(sets).map((s) => s.id)).toEqual(['s1', 'd1']);
    expect(loggedSets(sets, 'weight_reps').map((s) => s.id)).toEqual(['s1']);
    expect(bestLoggedSet(sets, 'weight_reps')?.id).toBe('s1');
    const exercise = {
      id: 'we1',
      exerciseId: 'press',
      exerciseName: 'Leg Press',
      muscleGroup: 'quadriceps',
      movementType: 'bilateral',
      loggingStyle: null,
      orderIndex: 1,
      sets,
    } as never;
    expect(computeTotalSets([exercise])).toBe(1);
    expect(computeTotalVolumeKg([exercise])).toBe(800 + 1080);
  });

  it('is never a lifetime top set or a top set on an exercise’s chart', () => {
    const history = [
      { setId: 's1', weightKg: 100, reps: 8, isDrop: false },
      { setId: 'd1', weightKg: 120, reps: 9, isDrop: true },
    ].map((s) => ({
      ...s,
      performedAt: '2026-11-20T10:00:00Z',
      workoutExerciseId: 'we1',
      exerciseId: 'press',
      exerciseName: 'Leg Press',
      muscleGroup: 'quadriceps',
      movementType: 'bilateral',
    })) as HistoricalSetWithExercise[];
    expect(computeTopSets(history).map((top) => top.setId)).toEqual(['s1']);
    expect(topSetProgression(history).map((point) => point.weightKg)).toEqual([100]);
  });
});
