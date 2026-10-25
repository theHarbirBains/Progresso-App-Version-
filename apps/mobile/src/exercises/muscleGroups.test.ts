import { SPLIT_MUSCLE_GROUP_LABELS, SPLIT_MUSCLE_GROUPS } from '../workouts/splitMuscleGroups';
import { MUSCLE_GROUP_LABELS, MUSCLE_GROUPS } from './muscleGroups';

describe('muscle groups', () => {
  it('has Adductors among the leg groups, after Hamstrings, for exercises and split days', () => {
    expect(MUSCLE_GROUPS.indexOf('adductors')).toBe(MUSCLE_GROUPS.indexOf('hamstrings') + 1);
    expect(MUSCLE_GROUP_LABELS.adductors).toBe('Adductors');
    expect(SPLIT_MUSCLE_GROUPS.indexOf('adductors')).toBe(
      SPLIT_MUSCLE_GROUPS.indexOf('hamstrings') + 1,
    );
    expect(SPLIT_MUSCLE_GROUP_LABELS.adductors).toBe('Adductors');
  });

  it('keeps every group it had, with no broad "Legs" group', () => {
    expect(MUSCLE_GROUPS).toEqual(
      expect.arrayContaining(['quadriceps', 'hamstrings', 'glutes', 'calves']),
    );
    expect(SPLIT_MUSCLE_GROUPS).toEqual(
      expect.arrayContaining(['quads', 'hamstrings', 'glutes', 'calves']),
    );
    expect(MUSCLE_GROUPS as readonly string[]).not.toContain('legs');
    expect(SPLIT_MUSCLE_GROUPS as readonly string[]).not.toContain('legs');
  });
});
