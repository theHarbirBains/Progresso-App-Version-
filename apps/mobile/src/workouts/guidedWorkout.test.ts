import { forgetGuided, isGuided, markGuided, plannedSetsFor, remainingPlan } from './guidedWorkout';
import type { PlannedExercise } from './splitPlanQueries';

function planned(exerciseId: string, targetSets = 3): PlannedExercise {
  return {
    id: `p-${exerciseId}`,
    exerciseId,
    exerciseName: exerciseId,
    muscleGroup: 'chest',
    movementType: 'bilateral',
    measurementType: 'weight_reps',
    position: 1,
    targetSets,
  };
}

describe('remainingPlan', () => {
  it('keeps the plan exercises not in the workout yet, in plan order', () => {
    const plan = [planned('bench'), planned('fly'), planned('dip')];
    expect(remainingPlan(plan, [{ exerciseId: 'fly' }]).map((p) => p.exerciseId)).toEqual([
      'bench',
      'dip',
    ]);
  });

  it('uses up one planned entry per exercise in the workout, so a second of the same stays', () => {
    const plan = [planned('bench'), planned('fly'), planned('bench')];
    expect(remainingPlan(plan, [{ exerciseId: 'bench' }]).map((p) => p.id)).toEqual([
      'p-fly',
      'p-bench',
    ]);
  });

  it('ignores exercises added that were never in the plan', () => {
    expect(remainingPlan([planned('bench')], [{ exerciseId: 'curl' }])).toHaveLength(1);
  });
});

describe('plannedSetsFor', () => {
  it("is the plan's sets for an exercise, or null when it isn't planned", () => {
    const plan = [planned('bench', 4)];
    expect(plannedSetsFor(plan, 'bench')).toBe(4);
    expect(plannedSetsFor(plan, 'curl')).toBeNull();
  });
});

describe('which workouts are guided', () => {
  it('is remembered on the device until forgotten', async () => {
    await expect(isGuided('w-guided')).resolves.toBe(false);
    await markGuided('w-guided');
    await expect(isGuided('w-guided')).resolves.toBe(true);
    await forgetGuided('w-guided');
    await expect(isGuided('w-guided')).resolves.toBe(false);
  });
});
