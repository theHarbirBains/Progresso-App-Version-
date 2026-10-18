import type { ExerciseRow } from './exerciseQueries';
import { groupExercisesByLetter, OTHER_LETTER } from './exerciseLibraryGrouping';

function exercise(name: string, id = name): ExerciseRow {
  return {
    id,
    name,
    muscleGroup: 'chest',
    movementType: 'bilateral',
    loggingStyle: null,
    measurementType: 'weight_reps',
    photoUrl: null,
    isActive: true,
    createdBy: null,
  };
}

describe('groupExercisesByLetter', () => {
  it('groups exercises under their first letter, uppercased', () => {
    const rows = [exercise('ab Wheel Rollout'), exercise('Arnold Press'), exercise('Barbell Row')];

    const sections = groupExercisesByLetter(rows);

    expect(sections).toEqual([
      { letter: 'A', data: [rows[0], rows[1]] },
      { letter: 'B', data: [rows[2]] },
    ]);
  });

  it("preserves each exercise's own position within its letter group (does not re-sort)", () => {
    const rows = [exercise('Zottman Curl'), exercise('Ab Crunch'), exercise('Zercher Squat')];

    const sections = groupExercisesByLetter(rows);

    expect(sections).toEqual([
      { letter: 'Z', data: [rows[0], rows[2]] },
      { letter: 'A', data: [rows[1]] },
    ]);
  });

  it('groups a name starting with a digit or symbol under "#"', () => {
    const rows = [exercise('21s Bicep Curl')];

    const sections = groupExercisesByLetter(rows);

    expect(sections).toEqual([{ letter: OTHER_LETTER, data: [rows[0]] }]);
  });

  it('returns no sections for an empty list', () => {
    expect(groupExercisesByLetter([])).toEqual([]);
  });
});
