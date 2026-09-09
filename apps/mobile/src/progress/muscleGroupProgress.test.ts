import type { HistoricalSetWithExercise } from '../workouts/exerciseHistoryGrouping';
import { computeMuscleGroupSetCounts, muscleGroupsForVisualization } from './muscleGroupProgress';

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

describe('muscleGroupsForVisualization', () => {
  it('maps to the coarser split-day vocabulary MuscleVisualization understands, deduplicated', () => {
    const counts = computeMuscleGroupSetCounts([set('quadriceps'), set('core'), set('shoulders')]);

    expect(muscleGroupsForVisualization(counts)).toEqual(
      expect.arrayContaining(['quads', 'abs', 'shoulders']),
    );
    expect(muscleGroupsForVisualization(counts)).toHaveLength(3);
  });

  it('excludes full_body and other -- no single anatomical region to highlight', () => {
    const counts = computeMuscleGroupSetCounts([set('full_body'), set('other'), set('chest')]);

    expect(muscleGroupsForVisualization(counts)).toEqual(['chest']);
  });
});
