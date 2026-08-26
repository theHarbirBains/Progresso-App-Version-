import type { HistoricalSet } from './exerciseHistoryQueries';
import {
  filterByTimeRange,
  mostCommonRepCount,
  repCountPRProgression,
  runningMax,
  topSetProgression,
  trueOneRepMaxProgression,
  workoutFrequency,
} from './exerciseProgress';

function hs(
  weightKg: number,
  reps: number,
  performedAt: string,
  workoutExerciseId: string,
): HistoricalSet {
  return { weightKg, reps, performedAt, workoutExerciseId };
}

describe('filterByTimeRange', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const sets = [
    hs(100, 8, '2026-05-25T00:00:00Z', 'we-recent'), // 7 days ago
    hs(100, 8, '2026-04-15T00:00:00Z', 'we-2m'), // ~47 days ago
    hs(100, 8, '2025-06-01T00:00:00Z', 'we-1y'), // exactly 1 year ago
  ];

  it('keeps only sets within the last 4 weeks', () => {
    const result = filterByTimeRange(sets, '4w', now);
    expect(result.map((s) => s.workoutExerciseId)).toEqual(['we-recent']);
  });

  it('keeps sets within the last 3 months', () => {
    const result = filterByTimeRange(sets, '3m', now);
    expect(result.map((s) => s.workoutExerciseId)).toEqual(['we-recent', 'we-2m']);
  });

  it('returns everything for "all"', () => {
    const result = filterByTimeRange(sets, 'all', now);
    expect(result).toHaveLength(3);
  });

  it('does not mutate or drop unrelated sets when the range boundary is exact', () => {
    const result = filterByTimeRange(sets, '1y', now);
    expect(result.map((s) => s.workoutExerciseId)).toContain('we-1y');
  });
});

describe('topSetProgression', () => {
  it('takes the heaviest set per workout occurrence, chronologically', () => {
    const sets = [
      hs(100, 10, '2026-01-01T00:00:00Z', 'we1'),
      hs(110, 8, '2026-01-01T00:00:00Z', 'we1'),
      hs(120, 5, '2025-12-01T00:00:00Z', 'we0'),
    ];

    const result = topSetProgression(sets);

    expect(result).toEqual([
      { performedAt: '2025-12-01T00:00:00Z', weightKg: 120 },
      { performedAt: '2026-01-01T00:00:00Z', weightKg: 110 },
    ]);
  });

  it('returns an empty array for no sets', () => {
    expect(topSetProgression([])).toEqual([]);
  });
});

describe('runningMax', () => {
  it('only advances when a set exceeds the current best', () => {
    const sets = [
      hs(100, 5, '2026-01-01T00:00:00Z', 'we1'),
      hs(90, 5, '2026-02-01T00:00:00Z', 'we2'),
      hs(110, 5, '2026-03-01T00:00:00Z', 'we3'),
    ];

    expect(runningMax(sets)).toEqual([
      { performedAt: '2026-01-01T00:00:00Z', weightKg: 100 },
      { performedAt: '2026-03-01T00:00:00Z', weightKg: 110 },
    ]);
  });

  it('sorts unsorted input before computing the running max', () => {
    const sets = [
      hs(110, 5, '2026-03-01T00:00:00Z', 'we3'),
      hs(100, 5, '2026-01-01T00:00:00Z', 'we1'),
    ];

    expect(runningMax(sets)).toEqual([
      { performedAt: '2026-01-01T00:00:00Z', weightKg: 100 },
      { performedAt: '2026-03-01T00:00:00Z', weightKg: 110 },
    ]);
  });
});

describe('repCountPRProgression / trueOneRepMaxProgression', () => {
  it('filters to one rep count before computing the running max', () => {
    const sets = [
      hs(100, 8, '2026-01-01T00:00:00Z', 'we1'),
      hs(150, 5, '2026-01-15T00:00:00Z', 'we2'),
      hs(110, 8, '2026-02-01T00:00:00Z', 'we3'),
    ];

    expect(repCountPRProgression(sets, 8)).toEqual([
      { performedAt: '2026-01-01T00:00:00Z', weightKg: 100 },
      { performedAt: '2026-02-01T00:00:00Z', weightKg: 110 },
    ]);
  });

  it('true 1RM progression only ever considers reps === 1', () => {
    const sets = [
      hs(200, 1, '2026-01-01T00:00:00Z', 'we1'),
      hs(300, 5, '2026-01-15T00:00:00Z', 'we2'),
      hs(225, 1, '2026-02-01T00:00:00Z', 'we3'),
    ];

    expect(trueOneRepMaxProgression(sets)).toEqual([
      { performedAt: '2026-01-01T00:00:00Z', weightKg: 200 },
      { performedAt: '2026-02-01T00:00:00Z', weightKg: 225 },
    ]);
  });

  it('returns an empty array when no 1-rep sets exist', () => {
    const sets = [hs(100, 8, '2026-01-01T00:00:00Z', 'we1')];
    expect(trueOneRepMaxProgression(sets)).toEqual([]);
  });
});

describe('mostCommonRepCount', () => {
  it('picks the rep count logged most often, ignoring 1-rep sets', () => {
    const sets = [
      hs(100, 8, '2026-01-01T00:00:00Z', 'we1'),
      hs(100, 8, '2026-01-02T00:00:00Z', 'we1'),
      hs(150, 5, '2026-01-03T00:00:00Z', 'we2'),
      hs(200, 1, '2026-01-04T00:00:00Z', 'we3'),
    ];

    expect(mostCommonRepCount(sets)).toBe(8);
  });

  it('breaks ties toward the lower rep count', () => {
    const sets = [
      hs(100, 10, '2026-01-01T00:00:00Z', 'we1'),
      hs(100, 5, '2026-01-02T00:00:00Z', 'we2'),
    ];

    expect(mostCommonRepCount(sets)).toBe(5);
  });

  it('returns null when there are no sets with reps >= 2', () => {
    expect(mostCommonRepCount([hs(200, 1, '2026-01-01T00:00:00Z', 'we1')])).toBeNull();
    expect(mostCommonRepCount([])).toBeNull();
  });
});

describe('workoutFrequency', () => {
  it('counts distinct workout occurrences, not individual sets', () => {
    const sets = [
      hs(100, 8, '2026-01-01T00:00:00Z', 'we1'),
      hs(110, 8, '2026-01-01T00:00:00Z', 'we1'),
      hs(120, 8, '2026-01-15T00:00:00Z', 'we2'),
    ];

    expect(workoutFrequency(sets)).toBe(2);
  });

  it('returns 0 for no sets', () => {
    expect(workoutFrequency([])).toBe(0);
  });
});
