import { mergeAndSortPRs } from './prFeed';
import type { OneRepMaxWithExercise, RepPRWithExercise } from '../workouts/prSummaryQueries';

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
