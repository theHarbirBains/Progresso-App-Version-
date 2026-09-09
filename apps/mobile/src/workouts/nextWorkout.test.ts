import { computeNextWorkout } from './nextWorkout';
import type { WorkoutSplitDetail } from './workoutSplitQueries';

const ppl: WorkoutSplitDetail = {
  id: 'split-1',
  name: 'PPL',
  days: [
    { id: 'day-push', name: 'Push', orderIndex: 1, muscleGroups: ['chest'] },
    { id: 'day-pull', name: 'Pull', orderIndex: 2, muscleGroups: ['back'] },
    { id: 'day-legs', name: 'Legs', orderIndex: 3, muscleGroups: ['quads', 'hamstrings'] },
  ],
};

describe('computeNextWorkout', () => {
  it('returns null for a split with no days', () => {
    expect(computeNextWorkout({ id: 's', name: 'Empty', days: [] }, null)).toBeNull();
  });

  it('recommends the first day when there is no relevant history', () => {
    const result = computeNextWorkout(ppl, null);

    expect(result).toEqual({
      splitId: 'split-1',
      splitName: 'PPL',
      day: { id: 'day-push', name: 'Push', orderIndex: 1, muscleGroups: ['chest'] },
      previousDayName: null,
    });
  });

  it('advances Push -> Pull', () => {
    const result = computeNextWorkout(ppl, 'day-push');

    expect(result?.day.name).toBe('Pull');
    expect(result?.previousDayName).toBe('Push');
  });

  it('advances Pull -> Legs', () => {
    const result = computeNextWorkout(ppl, 'day-pull');

    expect(result?.day.name).toBe('Legs');
    expect(result?.previousDayName).toBe('Pull');
  });

  it('loops Legs back to Push', () => {
    const result = computeNextWorkout(ppl, 'day-legs');

    expect(result?.day.name).toBe('Push');
    expect(result?.previousDayName).toBe('Legs');
  });

  it('falls back to day 1 when the last-tagged day no longer belongs to this split (split was swapped)', () => {
    const result = computeNextWorkout(ppl, 'day-from-a-different-split');

    expect(result?.day.name).toBe('Push');
    expect(result?.previousDayName).toBeNull();
  });

  it('does not depend on days being passed in order', () => {
    const shuffled: WorkoutSplitDetail = {
      ...ppl,
      days: [ppl.days[2], ppl.days[0], ppl.days[1]],
    };

    const result = computeNextWorkout(shuffled, 'day-push');

    expect(result?.day.name).toBe('Pull');
  });

  it('handles a single-day split by repeating that same day', () => {
    const oneDay: WorkoutSplitDetail = {
      id: 's',
      name: 'Full Body',
      days: [{ id: 'day-full', name: 'Full Body', orderIndex: 1, muscleGroups: ['chest'] }],
    };

    const result = computeNextWorkout(oneDay, 'day-full');

    expect(result?.day.name).toBe('Full Body');
    expect(result?.previousDayName).toBe('Full Body');
  });
});
