import type { EnrichedWorkoutSummary } from './workoutHistoryEnrichment';
import { computeMonthSummary, formatTotalTime } from './workoutMonthSummary';

function workout(overrides: Partial<EnrichedWorkoutSummary>): EnrichedWorkoutSummary {
  return {
    id: 'w1',
    name: 'Workout',
    performedAt: '2026-09-01T00:00:00Z',
    completedAt: '2026-09-01T01:00:00Z',
    workoutSplitDayId: null,
    splitDayName: null,
    muscleGroups: [],
    completedSetCount: 0,
    durationMinutes: 0,
    ...overrides,
  };
}

describe('computeMonthSummary', () => {
  it('is all zero for an empty month', () => {
    expect(computeMonthSummary([])).toEqual({ totalWorkouts: 0, totalMinutes: 0, totalSets: 0 });
  });

  it('sums workouts, minutes, and completed sets across the month', () => {
    const workouts = [
      workout({ id: 'w1', durationMinutes: 58, completedSetCount: 18 }),
      workout({ id: 'w2', durationMinutes: 62, completedSetCount: 15 }),
      workout({ id: 'w3', durationMinutes: 71, completedSetCount: 20 }),
    ];

    expect(computeMonthSummary(workouts)).toEqual({
      totalWorkouts: 3,
      totalMinutes: 191,
      totalSets: 53,
    });
  });

  it('treats a null duration as zero rather than breaking the sum', () => {
    const workouts = [workout({ durationMinutes: null, completedSetCount: 5 })];
    expect(computeMonthSummary(workouts)).toEqual({
      totalWorkouts: 1,
      totalMinutes: 0,
      totalSets: 5,
    });
  });
});

describe('formatTotalTime', () => {
  it('formats minutes under an hour as "Xm"', () => {
    expect(formatTotalTime(45)).toBe('45m');
  });

  it('formats an hour or more as "Xh Ym"', () => {
    expect(formatTotalTime(564)).toBe('9h 24m');
  });

  it('formats zero as "0m"', () => {
    expect(formatTotalTime(0)).toBe('0m');
  });
});
