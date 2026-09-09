import { deriveGlobalMilestones } from './globalMilestones';

describe('deriveGlobalMilestones', () => {
  it('shows First Workout and First PR as unachieved with no workout/PR history', () => {
    const milestones = deriveGlobalMilestones({
      totalWorkouts: 0,
      totalCompletedSets: 0,
      firstWorkoutAt: null,
      firstPRAt: null,
    });

    const firstWorkout = milestones.find((m) => m.key === 'first-workout')!;
    const firstPR = milestones.find((m) => m.key === 'first-pr')!;
    expect(firstWorkout.achieved).toBe(false);
    expect(firstPR.achieved).toBe(false);
  });

  it('marks First Workout and First PR achieved once real dates exist', () => {
    const milestones = deriveGlobalMilestones({
      totalWorkouts: 3,
      totalCompletedSets: 20,
      firstWorkoutAt: '2026-01-01T00:00:00Z',
      firstPRAt: '2026-01-05T00:00:00Z',
    });

    const firstWorkout = milestones.find((m) => m.key === 'first-workout')!;
    const firstPR = milestones.find((m) => m.key === 'first-pr')!;
    expect(firstWorkout.achieved).toBe(true);
    expect(firstWorkout.achievedAt).toBe('2026-01-01T00:00:00Z');
    expect(firstPR.achieved).toBe(true);
  });

  it('shows real progress toward the next unreached workout-count threshold', () => {
    const milestones = deriveGlobalMilestones({
      totalWorkouts: 47,
      totalCompletedSets: 0,
      firstWorkoutAt: '2026-01-01T00:00:00Z',
      firstPRAt: null,
    });

    const workoutMilestone = milestones.find((m) => m.key === 'workouts-50')!;
    expect(workoutMilestone.label).toBe('50 Workouts');
    expect(workoutMilestone.achieved).toBe(false);
    expect(workoutMilestone.progress).toEqual({ current: 47, target: 50 });
  });

  it('shows real progress toward the next unreached set-count threshold', () => {
    const milestones = deriveGlobalMilestones({
      totalWorkouts: 0,
      totalCompletedSets: 682,
      firstWorkoutAt: null,
      firstPRAt: null,
    });

    const setMilestone = milestones.find((m) => m.key === 'sets-1000')!;
    expect(setMilestone.label).toBe('1,000 Sets Completed');
    expect(setMilestone.achieved).toBe(false);
    expect(setMilestone.progress).toEqual({ current: 682, target: 1000 });
  });

  it('escalates to the next higher threshold once the current one is exactly reached', () => {
    const milestones = deriveGlobalMilestones({
      totalWorkouts: 100,
      totalCompletedSets: 0,
      firstWorkoutAt: '2026-01-01T00:00:00Z',
      firstPRAt: null,
    });

    // 100 is itself a threshold, already reached -- the useful next goal to
    // show is the next one up (250), not a stale "100/100" row.
    const workoutMilestone = milestones.find((m) => m.key === 'workouts-250')!;
    expect(workoutMilestone.achieved).toBe(false);
    expect(workoutMilestone.progress).toEqual({ current: 100, target: 250 });
  });

  it('caps at the highest threshold once every threshold is exceeded', () => {
    const milestones = deriveGlobalMilestones({
      totalWorkouts: 5000,
      totalCompletedSets: 50000,
      firstWorkoutAt: '2026-01-01T00:00:00Z',
      firstPRAt: '2026-01-02T00:00:00Z',
    });

    const workoutMilestone = milestones.find((m) => m.key === 'workouts-1000')!;
    const setMilestone = milestones.find((m) => m.key === 'sets-10000')!;
    expect(workoutMilestone.achieved).toBe(true);
    expect(setMilestone.achieved).toBe(true);
  });
});
