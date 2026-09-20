import { computeTopSets, TOP_SET_MIN_REPS } from './topSets';
import type { HistoricalSetWithExercise } from '../workouts/allExerciseHistoryQueries';

function set(overrides: Partial<HistoricalSetWithExercise> = {}): HistoricalSetWithExercise {
  return {
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
    weightKg: 100,
    reps: 8,
    performedAt: '2026-01-01T00:00:00Z',
    workoutExerciseId: 'we-1',
    ...overrides,
  };
}

describe('computeTopSets', () => {
  it('returns an empty list for no history', () => {
    expect(computeTopSets([])).toEqual([]);
  });

  it('picks the heaviest qualifying set for an exercise', () => {
    const rows = computeTopSets([
      set({ weightKg: 100, reps: 8 }),
      set({ weightKg: 120, reps: 6 }),
      set({ weightKg: 90, reps: 10 }),
    ]);

    expect(rows).toEqual([expect.objectContaining({ weightKg: 120, reps: 6 })]);
  });

  it(`excludes sets under ${TOP_SET_MIN_REPS} reps entirely, even if heavier`, () => {
    const rows = computeTopSets([set({ weightKg: 100, reps: 8 }), set({ weightKg: 150, reps: 3 })]);

    expect(rows).toEqual([expect.objectContaining({ weightKg: 100, reps: 8 })]);
  });

  it('omits an exercise entirely when it has no qualifying set at all', () => {
    const rows = computeTopSets([
      set({ exerciseId: 'ex-1', reps: 3 }),
      set({ exerciseId: 'ex-1', reps: 2 }),
    ]);

    expect(rows).toEqual([]);
  });

  it('never fabricates a row for an exercise with zero history', () => {
    expect(computeTopSets([set({ reps: 3 })])).toEqual([]);
  });

  it('breaks a weight tie toward the higher rep count', () => {
    const rows = computeTopSets([
      set({ weightKg: 100, reps: 5, performedAt: '2026-01-01T00:00:00Z' }),
      set({ weightKg: 100, reps: 8, performedAt: '2026-01-02T00:00:00Z' }),
    ]);

    expect(rows).toEqual([expect.objectContaining({ weightKg: 100, reps: 8 })]);
  });

  it('breaks a weight+rep tie toward the most recent date', () => {
    const rows = computeTopSets([
      set({ weightKg: 100, reps: 8, performedAt: '2026-01-01T00:00:00Z' }),
      set({ weightKg: 100, reps: 8, performedAt: '2026-03-01T00:00:00Z' }),
    ]);

    expect(rows).toEqual([expect.objectContaining({ performedAt: '2026-03-01T00:00:00Z' })]);
  });

  it('computes one row per exercise, independently, across multiple exercises', () => {
    const rows = computeTopSets([
      set({ exerciseId: 'ex-1', exerciseName: 'Bench Press', weightKg: 100, reps: 8 }),
      set({ exerciseId: 'ex-2', exerciseName: 'Squat', weightKg: 140, reps: 6 }),
    ]);

    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.exerciseId === 'ex-2')).toEqual(
      expect.objectContaining({ exerciseName: 'Squat', weightKg: 140, reps: 6 }),
    );
  });

  it('sorts the result alphabetically by exercise name', () => {
    const rows = computeTopSets([
      set({ exerciseId: 'ex-1', exerciseName: 'Squat', weightKg: 140, reps: 6 }),
      set({ exerciseId: 'ex-2', exerciseName: 'Bench Press', weightKg: 100, reps: 8 }),
      set({ exerciseId: 'ex-3', exerciseName: 'Deadlift', weightKg: 180, reps: 5 }),
    ]);

    expect(rows.map((r) => r.exerciseName)).toEqual(['Bench Press', 'Deadlift', 'Squat']);
  });

  it('carries the exercise’s muscle group through onto the row', () => {
    const rows = computeTopSets([set({ muscleGroup: 'quadriceps' })]);

    expect(rows[0].muscleGroup).toBe('quadriceps');
  });

  // Unilateral exercises stay one exercise with per-set rows (no side field
  // in this history feed, same as every other Progress derivation) -- each
  // side's set is just another candidate weight for the same exerciseId,
  // never merged/summed and never split into a second exercise identity.
  it('treats a unilateral exercise’s sets as ordinary candidates for the same exercise, without merging them', () => {
    const rows = computeTopSets([
      set({ exerciseId: 'ex-unilateral', exerciseName: 'Single-Arm Row', weightKg: 40, reps: 8 }),
      set({ exerciseId: 'ex-unilateral', exerciseName: 'Single-Arm Row', weightKg: 45, reps: 6 }),
    ]);

    expect(rows).toEqual([
      expect.objectContaining({ exerciseId: 'ex-unilateral', weightKg: 45, reps: 6 }),
    ]);
  });
});
