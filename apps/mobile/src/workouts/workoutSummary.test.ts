import { computeTotalSets, computeTotalVolumeKg } from './workoutSummary';
import type { WorkoutExerciseWithSets } from './workoutQueries';

function exercise(sets: WorkoutExerciseWithSets['sets']): WorkoutExerciseWithSets {
  return {
    id: 'we1',
    exerciseId: 'ex1',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    orderIndex: 1,
    sets,
  };
}

describe('computeTotalSets', () => {
  it('counts every set row, including blank/incomplete ones', () => {
    const exercises = [
      exercise([
        { id: 's1', setIndex: 1, weightKg: 100, reps: 5, completedAt: '2026-01-01T00:00:00Z' },
        { id: 's2', setIndex: 2, weightKg: null, reps: null, completedAt: null },
      ]),
    ];
    expect(computeTotalSets(exercises)).toBe(2);
  });

  it('sums across multiple exercises', () => {
    const exercises = [
      exercise([{ id: 's1', setIndex: 1, weightKg: 100, reps: 5, completedAt: null }]),
      exercise([
        { id: 's2', setIndex: 1, weightKg: 50, reps: 8, completedAt: null },
        { id: 's3', setIndex: 2, weightKg: 50, reps: 8, completedAt: null },
      ]),
    ];
    expect(computeTotalSets(exercises)).toBe(3);
  });

  it('returns 0 for no exercises', () => {
    expect(computeTotalSets([])).toBe(0);
  });
});

describe('computeTotalVolumeKg', () => {
  it('sums weight x reps only for logged (completed) sets', () => {
    const exercises = [
      exercise([
        { id: 's1', setIndex: 1, weightKg: 100, reps: 5, completedAt: '2026-01-01T00:00:00Z' },
        // Blank set: contributes nothing, even though it exists.
        { id: 's2', setIndex: 2, weightKg: null, reps: null, completedAt: null },
      ]),
    ];
    expect(computeTotalVolumeKg(exercises)).toBe(500);
  });

  it('sums across multiple exercises', () => {
    const exercises = [
      exercise([
        { id: 's1', setIndex: 1, weightKg: 100, reps: 5, completedAt: '2026-01-01T00:00:00Z' },
      ]),
      exercise([
        { id: 's2', setIndex: 1, weightKg: 50, reps: 10, completedAt: '2026-01-01T00:00:00Z' },
      ]),
    ];
    expect(computeTotalVolumeKg(exercises)).toBe(1000);
  });

  it('returns 0 when nothing has been logged yet', () => {
    const exercises = [
      exercise([{ id: 's1', setIndex: 1, weightKg: null, reps: null, completedAt: null }]),
    ];
    expect(computeTotalVolumeKg(exercises)).toBe(0);
  });
});
