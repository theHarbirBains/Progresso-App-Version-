import type { WorkoutExerciseWithSets } from './workoutQueries';
import { computeWorkoutTopSets, countCompletedExercises } from './recentWorkoutTopSets';

function set(id: string, weightKg: number | null, reps: number | null, completed = true) {
  return {
    id,
    setIndex: 1,
    side: null,
    weightKg,
    reps,
    completedAt: completed ? '2026-01-01T12:00:00Z' : null,
  };
}

function exercise(
  id: string,
  exerciseName: string,
  sets: ReturnType<typeof set>[],
): WorkoutExerciseWithSets {
  return {
    id: `we-${id}`,
    exerciseId: id,
    exerciseName,
    muscleGroup: 'chest',
    movementType: 'bilateral',
    loggingStyle: null,
    orderIndex: 1,
    sets,
  } as WorkoutExerciseWithSets;
}

describe('computeWorkoutTopSets', () => {
  it("takes each exercise's heaviest completed set, in the workout's own order", () => {
    const topSets = computeWorkoutTopSets([
      exercise('bench', 'Bench Press', [set('a', 200, 5), set('b', 225, 8), set('c', 215, 6)]),
      exercise('pulldown', 'Lat Pulldown', [set('d', 150, 10), set('e', 160, 10)]),
    ]);

    expect(topSets).toEqual([
      { exerciseId: 'bench', exerciseName: 'Bench Press', weightKg: 225, reps: 8 },
      { exerciseId: 'pulldown', exerciseName: 'Lat Pulldown', weightKg: 160, reps: 10 },
    ]);
  });

  it('ignores incomplete sets when picking the top set', () => {
    const topSets = computeWorkoutTopSets([
      exercise('bench', 'Bench Press', [set('a', 100, 5), set('b', 300, 1, false)]),
    ]);

    expect(topSets).toEqual([
      { exerciseId: 'bench', exerciseName: 'Bench Press', weightKg: 100, reps: 5 },
    ]);
  });

  it('omits an exercise with no completed set entirely -- never a placeholder row', () => {
    const topSets = computeWorkoutTopSets([
      exercise('bench', 'Bench Press', [set('a', null, null, false)]),
      exercise('row', 'Barbell Row', [set('b', 135, 8)]),
    ]);

    expect(topSets.map((t) => t.exerciseName)).toEqual(['Barbell Row']);
  });

  it('returns nothing for a workout with no completed sets at all', () => {
    expect(computeWorkoutTopSets([exercise('bench', 'Bench Press', [])])).toEqual([]);
  });
});

describe('countCompletedExercises', () => {
  it('counts only exercises that have at least one completed set', () => {
    expect(
      countCompletedExercises([
        exercise('bench', 'Bench Press', [set('a', 200, 5)]),
        exercise('row', 'Barbell Row', [set('b', null, null, false)]),
        exercise('curl', 'Curl', [set('c', 30, 10), set('d', 32.5, 8)]),
      ]),
    ).toBe(2);
  });
});
