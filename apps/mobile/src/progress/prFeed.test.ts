import { mergeAndSortPRs, recordValueText } from './prFeed';
import type {
  ExerciseRecordWithExercise,
  OneRepMaxWithExercise,
  RepPRWithExercise,
} from '../workouts/prSummaryQueries';

function repPR(overrides: Partial<RepPRWithExercise> = {}): RepPRWithExercise {
  return {
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    bestWeightKg: 100,
    reps: 8,
    achievedAt: '2026-01-01T00:00:00Z',
    sourceSetId: 'set-1',
    ...overrides,
  };
}

function oneRepMax(overrides: Partial<OneRepMaxWithExercise> = {}): OneRepMaxWithExercise {
  return {
    exerciseId: 'ex-2',
    exerciseName: 'Squat',
    weightKg: 140,
    achievedAt: '2026-02-01T00:00:00Z',
    sourceSetId: 'set-2',
    ...overrides,
  };
}

describe('mergeAndSortPRs', () => {
  it('returns an empty list for no records', () => {
    expect(mergeAndSortPRs([], [])).toEqual([]);
  });

  it('merges rep PRs and one-rep-maxes into a single feed', () => {
    const rows = mergeAndSortPRs([repPR()], [oneRepMax()]);

    expect(rows).toHaveLength(2);
  });

  it('sorts most recent first', () => {
    const older = repPR({ exerciseId: 'ex-old', achievedAt: '2026-01-01T00:00:00Z' });
    const newer = oneRepMax({ exerciseId: 'ex-new', achievedAt: '2026-03-01T00:00:00Z' });

    const rows = mergeAndSortPRs([older], [newer]);

    expect(rows.map((r) => r.exerciseId)).toEqual(['ex-new', 'ex-old']);
  });

  it('labels a rep PR with its rep count, and a 1RM as "1RM"', () => {
    const rows = mergeAndSortPRs([repPR({ reps: 6 })], [oneRepMax()]);

    expect(rows.find((r) => r.recordType === '6-Rep PR')).toBeTruthy();
    expect(rows.find((r) => r.recordType === '1RM')).toBeTruthy();
  });

  it('gives a rep PR its rep count, and a 1RM a null rep count', () => {
    const rows = mergeAndSortPRs([repPR({ reps: 6 })], [oneRepMax()]);

    expect(rows.find((r) => r.recordType === '6-Rep PR')?.reps).toBe(6);
    expect(rows.find((r) => r.recordType === '1RM')?.reps).toBeNull();
  });
});

function exerciseRecord(
  overrides: Partial<ExerciseRecordWithExercise> = {},
): ExerciseRecordWithExercise {
  return {
    measurementType: 'bodyweight',
    value: 25,
    exerciseId: 'ex-pushup',
    exerciseName: 'Push-Up',
    achievedAt: '2026-03-01T00:00:00Z',
    sourceSetId: 'set-3',
    ...overrides,
  };
}

describe('mergeAndSortPRs with bodyweight and timed records', () => {
  it('adds most reps and longest time, in date order with the weighted records', () => {
    const rows = mergeAndSortPRs(
      [repPR({ achievedAt: '2026-01-01T00:00:00Z' })],
      [],
      [
        exerciseRecord({ achievedAt: '2026-03-01T00:00:00Z' }),
        exerciseRecord({
          measurementType: 'timed',
          value: 90,
          exerciseId: 'ex-plank',
          exerciseName: 'Plank',
          achievedAt: '2026-02-01T00:00:00Z',
        }),
      ],
    );

    expect(rows.map((r) => r.recordType)).toEqual(['Most Reps', 'Longest', '8-Rep PR']);
    expect(rows[0]).toMatchObject({ reps: 25, weightKg: null, durationSeconds: null });
    expect(rows[1]).toMatchObject({ reps: null, weightKg: null, durationSeconds: 90 });
  });

  it('shows a record by what it measures, and leaves a weight to PRRow', () => {
    const [bodyweight, timed, weighted] = mergeAndSortPRs(
      [repPR({ achievedAt: '2026-01-01T00:00:00Z' })],
      [],
      [
        exerciseRecord({ achievedAt: '2026-03-01T00:00:00Z' }),
        exerciseRecord({
          measurementType: 'timed',
          value: 90,
          exerciseId: 'ex-plank',
          achievedAt: '2026-02-01T00:00:00Z',
        }),
      ],
    );

    expect(recordValueText(bodyweight, 'lb')).toBe('25 reps');
    expect(recordValueText(timed, 'lb')).toBe('1:30');
    expect(recordValueText(weighted, 'lb')).toBeUndefined();
  });
});
