import type { HistoricalSetWithExercise } from '../workouts/exerciseHistoryGrouping';
import { computeMuscleGroupSetCounts, computeMuscleGroupVolumeKg } from './muscleGroupProgress';

function set(
  muscleGroup: HistoricalSetWithExercise['muscleGroup'],
  overrides: Partial<HistoricalSetWithExercise> = {},
): HistoricalSetWithExercise {
  return {
    weightKg: 100,
    reps: 5,
    performedAt: '2026-01-01T00:00:00Z',
    workoutExerciseId: 'we1',
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    muscleGroup,
    movementType: 'bilateral',
    ...overrides,
  };
}

describe('computeMuscleGroupSetCounts', () => {
  it('counts real completed sets per muscle group, most-trained first', () => {
    const history = [set('chest'), set('chest'), set('back'), set('chest')];

    expect(computeMuscleGroupSetCounts(history)).toEqual([
      { group: 'chest', label: 'Chest', count: 3 },
      { group: 'back', label: 'Back', count: 1 },
    ]);
  });

  it('never includes a muscle group with zero sets', () => {
    expect(computeMuscleGroupSetCounts([])).toEqual([]);
  });

  it('includes full_body and other as their own real, labeled rows', () => {
    const history = [set('full_body'), set('other'), set('other')];

    expect(computeMuscleGroupSetCounts(history)).toEqual([
      { group: 'other', label: 'Other', count: 2 },
      { group: 'full_body', label: 'Full Body', count: 1 },
    ]);
  });
});

describe('computeMuscleGroupVolumeKg', () => {
  it('sums weight x reps per muscle group, heaviest first', () => {
    const history = [
      set('chest', { weightKg: 100, reps: 5 }),
      set('chest', { weightKg: 100, reps: 5 }),
      set('back', { weightKg: 80, reps: 10 }),
    ];

    expect(computeMuscleGroupVolumeKg(history)).toEqual([
      { group: 'chest', label: 'Chest', volumeKg: 1000 },
      { group: 'back', label: 'Back', volumeKg: 800 },
    ]);
  });

  it('never includes a muscle group with zero sets', () => {
    expect(computeMuscleGroupVolumeKg([])).toEqual([]);
  });
});
