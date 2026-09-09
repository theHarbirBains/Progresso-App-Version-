import type { WorkoutSummary } from '../workouts/workoutQueries';
import { computeFirstPRAt, computeLifetimeStats } from './lifetimeStats';

function workout(overrides: Partial<WorkoutSummary> = {}): WorkoutSummary {
  return {
    id: 'w1',
    name: 'Push Day',
    performedAt: '2026-01-01T10:00:00Z',
    completedAt: '2026-01-01T11:00:00Z',
    workoutSplitDayId: null,
    ...overrides,
  };
}

describe('computeLifetimeStats', () => {
  it('returns all zeros with no workout history', () => {
    expect(computeLifetimeStats([])).toEqual({
      totalWorkouts: 0,
      totalMinutes: 0,
      workoutsThisMonth: 0,
      avgWorkoutsPerWeek: 0,
      firstWorkoutAt: null,
    });
  });

  it('sums real workout durations (completed_at - performed_at)', () => {
    const stats = computeLifetimeStats([
      workout({ performedAt: '2026-01-01T10:00:00Z', completedAt: '2026-01-01T11:00:00Z' }),
      workout({ performedAt: '2026-01-02T10:00:00Z', completedAt: '2026-01-02T10:30:00Z' }),
    ]);

    expect(stats.totalWorkouts).toBe(2);
    expect(stats.totalMinutes).toBe(90);
  });

  it('counts only workouts performed in the current calendar month', () => {
    const now = new Date('2026-03-15T12:00:00Z');
    const stats = computeLifetimeStats(
      [
        workout({ performedAt: '2026-03-01T12:00:00Z' }),
        workout({ performedAt: '2026-03-10T12:00:00Z' }),
        workout({ performedAt: '2026-02-15T12:00:00Z' }),
      ],
      now,
    );

    expect(stats.workoutsThisMonth).toBe(2);
  });

  it('computes a real average workouts-per-week since the first workout', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    const stats = computeLifetimeStats(
      [
        workout({ performedAt: '2026-01-01T00:00:00Z' }),
        workout({ performedAt: '2026-01-08T00:00:00Z' }),
      ],
      now,
    );

    // 2 workouts over 2 weeks elapsed.
    expect(stats.avgWorkoutsPerWeek).toBe(1);
  });

  it('floors the elapsed span at one week so a brand-new account never divides by near-zero', () => {
    const now = new Date('2026-01-01T01:00:00Z');
    const stats = computeLifetimeStats([workout({ performedAt: '2026-01-01T00:00:00Z' })], now);

    expect(stats.avgWorkoutsPerWeek).toBe(1);
  });

  it('never counts an incomplete duration (should not happen for a completed-workout query, but stays 0 rather than NaN)', () => {
    const stats = computeLifetimeStats([workout({ completedAt: null })]);

    expect(stats.totalMinutes).toBe(0);
  });
});

describe('computeFirstPRAt', () => {
  it('returns null with no PR history', () => {
    expect(computeFirstPRAt([])).toBeNull();
  });

  it('returns the earliest date regardless of input order', () => {
    expect(
      computeFirstPRAt(['2026-02-01T00:00:00Z', '2026-01-05T00:00:00Z', '2026-03-01T00:00:00Z']),
    ).toBe('2026-01-05T00:00:00Z');
  });
});
