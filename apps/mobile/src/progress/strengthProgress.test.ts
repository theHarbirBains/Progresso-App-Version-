import type { HistoricalSet } from '../workouts/exerciseHistoryQueries';
import { computeStrengthProgress } from './strengthProgress';

function set(
  weightKg: number,
  reps: number,
  performedAt: string,
  workoutExerciseId: string,
): HistoricalSet {
  return { weightKg, reps, performedAt, workoutExerciseId };
}

describe('computeStrengthProgress', () => {
  it('returns "none" with fewer than two qualifying sessions', () => {
    const sets = [set(100, 8, '2026-01-01T00:00:00Z', 'we1')];

    expect(computeStrengthProgress(sets, 'all').level).toBe('none');
  });

  it('ignores sets below the Top Set qualifying rep threshold entirely', () => {
    // A single heavy low-rep attempt (2 reps) must never be treated as a
    // "weight increase" against a real working set.
    const sets = [
      set(100, 8, '2026-01-01T00:00:00Z', 'we1'),
      set(150, 2, '2026-01-08T00:00:00Z', 'we2'),
    ];

    const result = computeStrengthProgress(sets, 'all');
    expect(result.points).toHaveLength(1);
    expect(result.level).toBe('none');
  });

  it('returns "none" for a regression or no change, never negative progress', () => {
    const flat = [
      set(100, 8, '2026-01-01T00:00:00Z', 'we1'),
      set(100, 9, '2026-01-08T00:00:00Z', 'we2'),
    ];
    expect(computeStrengthProgress(flat, 'all').level).toBe('none');

    const regressed = [
      set(120, 8, '2026-01-01T00:00:00Z', 'we1'),
      set(100, 8, '2026-01-08T00:00:00Z', 'we2'),
    ];
    expect(computeStrengthProgress(regressed, 'all').level).toBe('none');
  });

  it('classifies a small, real gain across few sessions as "progressing", not "significant"', () => {
    const sets = [
      set(100, 8, '2026-01-01T00:00:00Z', 'we1'),
      set(105, 8, '2026-01-08T00:00:00Z', 'we2'),
    ];

    expect(computeStrengthProgress(sets, 'all').level).toBe('progressing');
  });

  it('requires both a clear relative gain AND sustained sessions for "significant"', () => {
    // Large % gain, but only 2 sessions -- not sustained.
    const bigJumpFewSessions = [
      set(100, 8, '2026-01-01T00:00:00Z', 'we1'),
      set(130, 8, '2026-01-08T00:00:00Z', 'we2'),
    ];
    expect(computeStrengthProgress(bigJumpFewSessions, 'all').level).toBe('progressing');

    // Many sessions, but a marginal % gain -- not clear.
    const manySessionsSmallGain = [
      set(100, 8, '2026-01-01T00:00:00Z', 'we1'),
      set(101, 8, '2026-01-08T00:00:00Z', 'we2'),
      set(102, 8, '2026-01-15T00:00:00Z', 'we3'),
      set(103, 8, '2026-01-22T00:00:00Z', 'we4'),
    ];
    expect(computeStrengthProgress(manySessionsSmallGain, 'all').level).toBe('progressing');

    // Both sustained AND a clear relative gain -- significant.
    const sustainedBigGain = [
      set(100, 8, '2026-01-01T00:00:00Z', 'we1'),
      set(108, 8, '2026-01-08T00:00:00Z', 'we2'),
      set(115, 8, '2026-01-15T00:00:00Z', 'we3'),
      set(120, 8, '2026-01-22T00:00:00Z', 'we4'),
    ];
    expect(computeStrengthProgress(sustainedBigGain, 'all').level).toBe('significant');
  });

  it('respects the given time range, matching filterByTimeRange', () => {
    const now = Date.now();
    const daysAgo = (days: number) => new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
    const sets = [
      set(80, 8, daysAgo(90), 'we-old'), // well outside 4 weeks
      set(120, 8, daysAgo(3), 'we-recent'),
    ];

    const result = computeStrengthProgress(sets, '4w');

    expect(result.points).toHaveLength(1);
    expect(result.points[0].weightKg).toBe(120);
  });
});
