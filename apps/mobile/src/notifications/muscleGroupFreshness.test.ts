import type { HistoricalSetWithExercise } from '../workouts/exerciseHistoryGrouping';
import { computeStaleMuscleGroups } from './muscleGroupFreshness';

const NOW = new Date('2026-01-15T00:00:00Z');

function set(
  muscleGroup: HistoricalSetWithExercise['muscleGroup'],
  performedAt: string,
): HistoricalSetWithExercise {
  return {
    weightKg: 100,
    reps: 5,
    performedAt,
    workoutExerciseId: 'we1',
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    muscleGroup,
    movementType: 'bilateral',
  };
}

describe('computeStaleMuscleGroups', () => {
  it('flags a muscle group last trained at or beyond the threshold', () => {
    // 15 days since chest, well past the 7-day default.
    const history = [set('chest', '2025-12-31T00:00:00Z')];

    const result = computeStaleMuscleGroups(history, NOW);

    expect(result).toEqual([
      {
        muscleGroup: 'chest',
        label: 'Chest',
        lastTrainedAt: '2025-12-31T00:00:00Z',
        daysSince: 15,
      },
    ]);
  });

  it('does not flag a muscle group trained within the threshold', () => {
    // 2 days since back -- fresh.
    const history = [set('back', '2026-01-13T00:00:00Z')];

    expect(computeStaleMuscleGroups(history, NOW)).toEqual([]);
  });

  it('never flags a muscle group with zero history -- that is "not trained", not "stale"', () => {
    expect(computeStaleMuscleGroups([], NOW)).toEqual([]);
  });

  it('uses only the most recent set per muscle group, not the oldest', () => {
    const history = [
      set('chest', '2025-01-01T00:00:00Z'), // ancient
      set('chest', '2026-01-10T00:00:00Z'), // recent -- 5 days since, fresh
    ];

    expect(computeStaleMuscleGroups(history, NOW)).toEqual([]);
  });

  it('sorts by longest-stale first', () => {
    const history = [
      set('chest', '2026-01-05T00:00:00Z'), // 10 days
      set('back', '2025-12-20T00:00:00Z'), // 26 days
    ];

    const result = computeStaleMuscleGroups(history, NOW);

    expect(result.map((r) => r.muscleGroup)).toEqual(['back', 'chest']);
  });

  it('respects a custom threshold', () => {
    const history = [set('chest', '2026-01-12T00:00:00Z')]; // 3 days

    expect(computeStaleMuscleGroups(history, NOW, 2)).toEqual([
      { muscleGroup: 'chest', label: 'Chest', lastTrainedAt: '2026-01-12T00:00:00Z', daysSince: 3 },
    ]);
    expect(computeStaleMuscleGroups(history, NOW, 7)).toEqual([]);
  });
});
