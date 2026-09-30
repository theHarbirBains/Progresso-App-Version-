import {
  buildNextWorkoutMessage,
  computeNextWorkoutDay,
  type SplitDayForReminder,
} from './next-workout.util';

const push: SplitDayForReminder = {
  id: 'day-push',
  name: 'Push',
  orderIndex: 1,
  muscleGroups: ['chest', 'shoulders', 'triceps'],
};
const pull: SplitDayForReminder = {
  id: 'day-pull',
  name: 'Pull',
  orderIndex: 2,
  muscleGroups: ['back', 'biceps'],
};
const legs: SplitDayForReminder = {
  id: 'day-legs',
  name: 'Legs',
  orderIndex: 3,
  muscleGroups: [],
};

describe('computeNextWorkoutDay', () => {
  it('returns null for a split with no days', () => {
    expect(computeNextWorkoutDay([], null)).toBeNull();
  });

  it('recommends the first day (by order) when nothing has been completed yet', () => {
    expect(computeNextWorkoutDay([pull, push, legs], null)).toEqual(push);
  });

  it('recommends the day after the last-completed one', () => {
    expect(computeNextWorkoutDay([push, pull, legs], 'day-push')).toEqual(pull);
  });

  it('cycles back to the first day after the last one', () => {
    expect(computeNextWorkoutDay([push, pull, legs], 'day-legs')).toEqual(push);
  });

  it('falls back to the first day when the last-tagged day no longer belongs to this split', () => {
    expect(computeNextWorkoutDay([push, pull], 'day-from-a-different-split')).toEqual(push);
  });

  it('sorts by orderIndex regardless of input array order', () => {
    expect(computeNextWorkoutDay([legs, push, pull], 'day-push')).toEqual(pull);
  });
});

describe('buildNextWorkoutMessage', () => {
  it("joins muscle groups with an ampersand, matching the app's own reminder copy", () => {
    expect(buildNextWorkoutMessage('Harbir', push)).toBe(
      "Come on Harbir, you've got chest, shoulders, & triceps waiting to be crushed.",
    );
  });

  it('joins exactly two muscle groups with just an ampersand, no comma', () => {
    expect(buildNextWorkoutMessage('Harbir', pull)).toBe(
      "Come on Harbir, you've got back & biceps waiting to be crushed.",
    );
  });

  it('falls back to the day name when it has no muscle groups tagged', () => {
    expect(buildNextWorkoutMessage('Harbir', legs)).toBe(
      'Come on Harbir, your Legs workout is waiting to be crushed.',
    );
  });

  it('falls back to "there" when the user has no display name', () => {
    expect(buildNextWorkoutMessage(null, push)).toBe(
      "Come on there, you've got chest, shoulders, & triceps waiting to be crushed.",
    );
  });

  it('humanizes an underscored muscle group name (e.g. full_body)', () => {
    const fullBody: SplitDayForReminder = {
      id: 'day-full',
      name: 'Full Body',
      orderIndex: 1,
      muscleGroups: ['full_body'],
    };
    expect(buildNextWorkoutMessage('Harbir', fullBody)).toBe(
      "Come on Harbir, you've got full body waiting to be crushed.",
    );
  });
});
