import { computeTotalSets, computeTotalVolumeKg } from './workoutSummary';
import type { WorkoutExerciseWithSets } from './workoutQueries';

function exercise(
  sets: Omit<WorkoutExerciseWithSets['sets'][number], 'side'>[],
  overrides: Partial<WorkoutExerciseWithSets> = {},
): WorkoutExerciseWithSets {
  return {
    id: 'we1',
    exerciseId: 'ex1',
    exerciseName: 'Bench Press',
    muscleGroup: 'chest',
    movementType: 'bilateral',
    loggingStyle: null,
    orderIndex: 1,
    sets: sets.map((s) => ({ ...s, side: null })),
    ...overrides,
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

  it('sums a unilateral exercise\'s left and right rows independently, never combining their weight', () => {
    // Bulgarian Split Squat, one logical set: left 42.5kg x10, right 40kg x10.
    // Real total work performed is additive (1105kg), but neither row's own
    // weight is ever summed into the other -- that distinction is what this
    // guards (see the migration/UI comments on "weight is always per side").
    const exercises: WorkoutExerciseWithSets[] = [
      {
        id: 'we-bss',
        exerciseId: 'ex-bss',
        exerciseName: 'Bulgarian Split Squat',
        muscleGroup: 'quadriceps',
        movementType: 'unilateral',
        loggingStyle: 'alternating',
        orderIndex: 1,
        sets: [
          {
            id: 's-left',
            setIndex: 1,
            side: 'left',
            weightKg: 42.5,
            reps: 10,
            completedAt: '2026-01-01T00:00:00Z',
          },
          {
            id: 's-right',
            setIndex: 1,
            side: 'right',
            weightKg: 40,
            reps: 10,
            completedAt: '2026-01-01T00:00:00Z',
          },
        ],
      },
    ];

    expect(computeTotalSets(exercises)).toBe(2);
    expect(computeTotalVolumeKg(exercises)).toBe(42.5 * 10 + 40 * 10);
  });
});
