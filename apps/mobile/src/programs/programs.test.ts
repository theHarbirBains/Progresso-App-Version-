import { SECOND_PROGRAM, TEST_PROGRAM } from './__fixtures__/programs';
import {
  daysLabel,
  defaultVariation,
  exerciseInfo,
  frequencyChoices,
  levelInitial,
  levelsLabel,
  matchesFilters,
  NO_FILTERS,
  prescription,
  programProblems,
  restLabel,
  schedulesOf,
  splitNameFor,
  variationById,
  variationMuscles,
  variationsOn,
} from './programs';
import type { WorkoutProgram } from './programTypes';

describe('reading a program', () => {
  it('finds its schedules in the order written, each with its days a week', () => {
    expect(schedulesOf(TEST_PROGRAM)).toEqual([
      { schedule: '3-Day', note: 'Standard', daysPerWeek: 3 },
      { schedule: '6-Day', note: 'High Volume', daysPerWeek: 6 },
    ]);
    expect(daysLabel(TEST_PROGRAM)).toBe('3 or 6 days');
    expect(daysLabel(SECOND_PROGRAM)).toBe('4 days');
  });

  it('shows the default variation first, and falls back to it for an id it has not got', () => {
    expect(defaultVariation(TEST_PROGRAM).id).toBe('three-balanced');
    expect(variationById(TEST_PROGRAM, 'six').id).toBe('six');
    expect(variationById(TEST_PROGRAM, 'gone').id).toBe('three-balanced');
    expect(variationsOn(TEST_PROGRAM, '3-Day').map((v) => v.id)).toEqual([
      'three-balanced',
      'three-strength',
    ]);
  });

  it('says who it suits in a few words', () => {
    expect(levelsLabel(['beginner', 'intermediate', 'advanced'])).toBe('Beginner to Advanced');
    expect(levelsLabel(['advanced', 'beginner'])).toBe('Beginner and Advanced');
    expect(levelsLabel(['intermediate'])).toBe('Intermediate');
    expect(levelInitial(['intermediate', 'advanced'])).toBe('I');
  });

  it('says what is planned for an exercise, and its rest', () => {
    const [bench, raise] = TEST_PROGRAM.variations[0]!.days[0]!.exercises;
    expect(prescription(bench!)).toBe('3 sets · 6–8 reps');
    expect(prescription(raise!)).toBe('3 sets · 12–15 reps');
    expect(prescription({ slug: 'x', sets: 1, reps: 1 })).toBe('1 set · 1 rep');
    expect(prescription({ slug: 'x', sets: 2, seconds: { min: 30, max: 45 } })).toBe(
      '2 sets · 30–45 s',
    );
    expect(prescription({ slug: 'x', sets: 4 })).toBe('4 sets');
    expect(restLabel(90)).toBe('Rest 1 min 30 s');
    expect(restLabel(120)).toBe('Rest 2 min');
    expect(restLabel(45)).toBe('Rest 45 s');
  });

  it('gathers what a variation trains, in the usual order', () => {
    expect(variationMuscles(defaultVariation(TEST_PROGRAM))).toEqual([
      'chest',
      'back',
      'shoulders',
      'biceps',
      'triceps',
      'quads',
      'hamstrings',
      'glutes',
    ]);
  });

  it("names an exercise from the app's own catalogue", () => {
    expect(exerciseInfo('db-bench-press')).toMatchObject({
      name: 'Dumbbell Bench Press',
      muscle: 'Chest',
      equipment: 'Dumbbell',
    });
    expect(exerciseInfo('not-an-exercise')).toBeNull();
  });

  it('names a split for its schedule and focus only where the program has several', () => {
    expect(splitNameFor(TEST_PROGRAM, variationById(TEST_PROGRAM, 'three-strength'))).toBe(
      'Test Split (3-Day, Strength Focus)',
    );
    expect(splitNameFor(TEST_PROGRAM, variationById(TEST_PROGRAM, 'six'))).toBe(
      'Test Split (6-Day)',
    );
    expect(splitNameFor(SECOND_PROGRAM, defaultVariation(SECOND_PROGRAM))).toBe('Second Program');
  });
});

describe('filtering the library', () => {
  const programs = [TEST_PROGRAM, SECOND_PROGRAM];
  const shown = (filters: Partial<typeof NO_FILTERS>) =>
    programs.filter((p) => matchesFilters(p, { ...NO_FILTERS, ...filters })).map((p) => p.id);

  it('by experience, days a week, focus and goal', () => {
    expect(shown({})).toEqual(['test-split', 'second-program']);
    expect(shown({ level: 'advanced' })).toEqual(['test-split']);
    expect(shown({ daysPerWeek: 4 })).toEqual(['second-program']);
    expect(shown({ daysPerWeek: 6 })).toEqual(['test-split']);
    expect(shown({ focus: 'lower_body' })).toEqual(['second-program']);
    expect(shown({ goal: 'get_stronger' })).toEqual(['test-split']);
    expect(shown({ level: 'beginner', goal: 'lose_fat' })).toEqual(['second-program']);
  });

  it('offers every days-a-week a program has', () => {
    expect(frequencyChoices(programs)).toEqual([3, 4, 6]);
  });
});

describe('programProblems', () => {
  it('passes a program written so it can be used', () => {
    expect(programProblems(TEST_PROGRAM)).toEqual([]);
    expect(programProblems(SECOND_PROGRAM)).toEqual([]);
  });

  it('names every problem: an exercise not in use, sets a split day cannot hold, a range backwards, two defaults', () => {
    const broken: WorkoutProgram = {
      ...SECOND_PROGRAM,
      variations: [
        {
          id: 'a',
          schedule: '1-Day',
          default: true,
          days: [
            {
              name: 'Day',
              muscleGroups: ['chest'],
              exercises: [
                { slug: 'bb-behind-the-neck-press', sets: 3, reps: 8 },
                { slug: 'db-bench-press', sets: 25, reps: { min: 10, max: 6 } },
                { slug: 'db-curl', sets: 3, alternatives: ['db-curl', 'nope'] },
              ],
            },
          ],
        },
        { id: 'b', schedule: '1-Day', default: true, days: [] },
      ],
    };
    const problems = programProblems(broken).join('\n');
    expect(problems).toMatch(/bb-behind-the-neck-press isn't an active built-in exercise/);
    expect(problems).toMatch(/sets must be a whole number from 1 to 20/);
    expect(problems).toMatch(/a range must go from its lower number to its higher/);
    expect(problems).toMatch(/alternative nope isn't an active built-in exercise/);
    expect(problems).toMatch(/lists itself as an alternative/);
    expect(problems).toMatch(/variation b has no days/);
    expect(problems).toMatch(/schedule 1-Day has more than one default/);
  });
});
