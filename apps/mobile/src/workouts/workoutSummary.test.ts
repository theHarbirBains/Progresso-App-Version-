import {
  computeTotalSets,
  computeTotalVolumeKg,
  formatVolume,
  volumeInUnit,
} from './workoutSummary';
import type { WorkoutExerciseWithSets } from './workoutQueries';

function exercise(
  sets: Omit<WorkoutExerciseWithSets['sets'][number], 'side'>[],
  overrides: Partial<WorkoutExerciseWithSets> = {},
): WorkoutExerciseWithSets {
  return {
    id: 'we1',
    exerciseId: 'ex1',
    exerciseName: 'Bench Press',
    photoUrl: null,
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

  it("sums a unilateral exercise's left and right rows independently, never combining their weight", () => {
    // Bulgarian Split Squat, one logical set: left 42.5kg x10, right 40kg x10.
    // Real total work performed is additive (1105kg), but neither row's own
    // weight is ever summed into the other -- that distinction is what this
    // guards (see the migration/UI comments on "weight is always per side").
    const exercises: WorkoutExerciseWithSets[] = [
      {
        id: 'we-bss',
        exerciseId: 'ex-bss',
        exerciseName: 'Bulgarian Split Squat',
        photoUrl: null,
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

describe('volumeInUnit / formatVolume', () => {
  // The app's real write path: a typed lb weight is converted to kg and
  // rounded to 2dp (ActiveWorkoutScreen -> roundWeight(toKg(...))).
  const KG_PER_LB = 0.45359237;
  const storeLb = (lb: number) => Math.round(lb * KG_PER_LB * 100) / 100;

  it('recovers the exact pound volume for every valid entry (whole or .5) at every rep count', () => {
    for (let half = 1; half <= 1000; half++) {
      const lb = half / 2;
      for (const reps of [1, 5, 8, 10, 12, 20]) {
        const exact = lb * reps;
        const got = volumeInUnit([{ weightKg: storeLb(lb), reps }], 'lb');
        expect(got).toBe(exact);
      }
    }
  });

  it('sums a whole workout exactly, with no drift across many sets', () => {
    const entries: [number, number][] = [
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
      [135, 10],
    ];
    const sets = entries.map(([lb, reps]) => ({ weightKg: storeLb(lb), reps }));
    expect(volumeInUnit(sets, 'lb')).toBe(24300);
  });

  it('keeps a .5 total as .5', () => {
    const sets = [
      { weightKg: storeLb(52.5), reps: 3 },
      { weightKg: storeLb(135), reps: 10 },
    ];
    expect(volumeInUnit(sets, 'lb')).toBe(1507.5);
    expect(formatVolume(1507.5)).toBe('1,507.5');
  });

  it('formats whole numbers without a decimal, and never shows a .9 artifact', () => {
    expect(formatVolume(3150)).toBe('3,150');
    expect(formatVolume(3149.9)).toBe('3,150');
    expect(formatVolume(0)).toBe('0');
  });

  it('reports kg volume exactly for kg entries (kg weights are stored without loss)', () => {
    const sets = [
      { weightKg: 100, reps: 5 },
      { weightKg: 52.5, reps: 8 },
    ];
    expect(volumeInUnit(sets, 'kg')).toBe(920);
  });
});
