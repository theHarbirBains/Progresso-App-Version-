import { addExerciseToWorkout, createSet } from './workoutQueries';
import { applyPlanToWorkout, type PlannedExercise } from './splitPlanQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));
jest.mock('./workoutQueries', () => ({
  addExerciseToWorkout: jest.fn(),
  createSet: jest.fn(),
}));

function planned(overrides: Partial<PlannedExercise>): PlannedExercise {
  return {
    id: 'p',
    exerciseId: 'ex',
    exerciseName: 'Exercise',
    muscleGroup: 'chest',
    movementType: 'bilateral',
    measurementType: 'weight_reps',
    position: 0,
    targetSets: 3,
    ...overrides,
  };
}

describe('applyPlanToWorkout', () => {
  it('adds each planned exercise in order with its sets; a unilateral set is a left and a right', async () => {
    (addExerciseToWorkout as jest.Mock)
      .mockResolvedValueOnce('we-bench')
      .mockResolvedValueOnce('we-lunge');
    (createSet as jest.Mock).mockResolvedValue({});

    await applyPlanToWorkout('w1', [
      planned({ exerciseId: 'bench', targetSets: 2 }),
      planned({ exerciseId: 'lunge', targetSets: 1, movementType: 'unilateral' }),
    ]);

    expect((addExerciseToWorkout as jest.Mock).mock.calls).toEqual([
      ['w1', 'bench', 1],
      ['w1', 'lunge', 2],
    ]);
    expect((createSet as jest.Mock).mock.calls).toEqual([
      ['we-bench', 1],
      ['we-bench', 2],
      ['we-lunge', 1, 'left'],
      ['we-lunge', 1, 'right'],
    ]);
  });
});
