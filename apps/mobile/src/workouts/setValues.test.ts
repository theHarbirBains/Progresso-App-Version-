import {
  bestLoggedSet,
  formatSetValues,
  holdsMeasurement,
  loggedSets,
  setValuesOf,
} from './setValues';
import type { SetRecord } from './workoutQueries';

const DONE = '2026-10-18T10:00:00.000Z';

function set(id: string, setIndex: number, extra: Partial<SetRecord> = {}): SetRecord {
  return {
    id,
    setIndex,
    side: null,
    weightKg: null,
    reps: null,
    durationSeconds: null,
    completedAt: DONE,
    ...extra,
  };
}

describe('holdsMeasurement', () => {
  it('needs a weight and reps for a weighted set', () => {
    expect(holdsMeasurement(set('a', 1, { weightKg: 100, reps: 5 }), 'weight_reps')).toBe(true);
    expect(holdsMeasurement(set('a', 1, { reps: 5 }), 'weight_reps')).toBe(false);
  });

  it('needs only reps at bodyweight', () => {
    expect(holdsMeasurement(set('a', 1, { reps: 20 }), 'bodyweight')).toBe(true);
    expect(holdsMeasurement(set('a', 1), 'bodyweight')).toBe(false);
  });

  it('needs only a time when timed, and a set from before durations has none', () => {
    expect(holdsMeasurement(set('a', 1, { durationSeconds: 45 }), 'timed')).toBe(true);
    expect(holdsMeasurement(set('a', 1, { durationSeconds: undefined }), 'timed')).toBe(false);
  });
});

describe('loggedSets', () => {
  it('keeps the completed sets that hold their measurement, in order', () => {
    const sets = [
      set('a', 1, { reps: 20 }),
      set('b', 2, { reps: 15, completedAt: null }),
      set('c', 3),
      set('d', 4, { reps: 12 }),
    ];

    expect(loggedSets(sets, 'bodyweight').map((s) => s.id)).toEqual(['a', 'd']);
  });
});

describe('bestLoggedSet', () => {
  it('is the heaviest weighted set, the most reps, or the longest time', () => {
    expect(
      bestLoggedSet(
        [set('a', 1, { weightKg: 100, reps: 8 }), set('b', 2, { weightKg: 110, reps: 3 })],
        'weight_reps',
      )?.id,
    ).toBe('b');
    expect(
      bestLoggedSet([set('a', 1, { reps: 20 }), set('b', 2, { reps: 25 })], 'bodyweight')?.id,
    ).toBe('b');
    expect(
      bestLoggedSet(
        [set('a', 1, { durationSeconds: 90 }), set('b', 2, { durationSeconds: 60 })],
        'timed',
      )?.id,
    ).toBe('a');
  });

  it('keeps the first set on a tie, and is null when nothing was logged', () => {
    expect(
      bestLoggedSet([set('a', 1, { reps: 20 }), set('b', 2, { reps: 20 })], 'bodyweight')?.id,
    ).toBe('a');
    expect(bestLoggedSet([set('a', 1, { completedAt: null, reps: 5 })], 'bodyweight')).toBeNull();
  });
});

describe('setValuesOf', () => {
  it('carries only what the type records', () => {
    // An older app could send a weight with push-ups; it isn't part of the set.
    expect(setValuesOf(set('a', 1, { weightKg: 80, reps: 20 }), 'bodyweight')).toEqual({
      measurementType: 'bodyweight',
      weightKg: null,
      reps: 20,
      durationSeconds: null,
    });
    expect(setValuesOf(set('a', 1, { durationSeconds: 90 }), 'timed')).toEqual({
      measurementType: 'timed',
      weightKg: null,
      reps: null,
      durationSeconds: 90,
    });
  });
});

describe('formatSetValues', () => {
  it('shows a weight and reps, reps, or a time', () => {
    expect(formatSetValues({ measurementType: 'weight_reps', weightKg: 100, reps: 5 }, 'kg')).toBe(
      '100 kg × 5',
    );
    expect(formatSetValues({ measurementType: 'bodyweight', reps: 1 }, 'kg')).toBe('1 rep');
    expect(formatSetValues({ measurementType: 'bodyweight', reps: 15 }, 'kg')).toBe('15 reps');
    expect(formatSetValues({ measurementType: 'timed', durationSeconds: 90 }, 'kg')).toBe('1:30');
  });

  it('treats a missing type as weight and reps', () => {
    expect(formatSetValues({ weightKg: 100, reps: 5 }, 'kg')).toBe('100 kg × 5');
  });
});
