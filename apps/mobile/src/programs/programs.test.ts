import { SECOND_PROGRAM, TEST_PROGRAM } from './__fixtures__/programs';
import { assemblePrograms } from './programAssembly';
import {
  catalogProblems,
  daysLabel,
  defaultVariation,
  equipmentFits,
  equipmentLabel,
  exerciseInfo,
  filtersSet,
  focusSummary,
  frequencyChoices,
  frequencySections,
  levelInitial,
  levelsLabel,
  matchesFilters,
  matchingVariations,
  NO_FILTERS,
  prescription,
  priorityFull,
  programLevels,
  programProblems,
  restLabel,
  schedulesOf,
  splitNameFor,
  styleLabel,
  togglePriority,
  variationById,
  variationLabel,
  variationMuscles,
  variationsOn,
  type ProgramFilters,
} from './programs';
import type { CatalogProgram, ProgramContent, WorkoutProgram } from './programTypes';

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
  const shown = (filters: Partial<ProgramFilters>) =>
    programs.filter((p) => matchesFilters(p, { ...NO_FILTERS, ...filters })).map((p) => p.id);

  it('by days a week, experience, goal, muscle focus, style, equipment and what is left out', () => {
    expect(shown({})).toEqual(['test-split', 'second-program']);
    expect(shown({ daysPerWeek: 4 })).toEqual(['second-program']);
    expect(shown({ daysPerWeek: 6 })).toEqual(['test-split']);
    expect(shown({ level: 'advanced' })).toEqual(['test-split']);
    expect(shown({ goal: 'get_stronger' })).toEqual(['test-split']);
    expect(shown({ emphasis: 'glutes' })).toEqual(['second-program']);
    expect(shown({ emphasis: 'balanced' })).toEqual(['test-split']);
    expect(shown({ style: 'strength' })).toEqual(['test-split']);
    expect(shown({ exclusion: 'chest' })).toEqual(['second-program']);
    // Dumbbells only finds what needs no more than dumbbells.
    expect(shown({ equipment: 'dumbbells' })).toEqual(['second-program']);
    expect(shown({ equipment: 'full_gym' })).toEqual(['test-split', 'second-program']);
  });

  it('applies every filter together, to the same variation', () => {
    // The strength variation is 3-day: there's no 6-day strength one.
    expect(shown({ style: 'strength', daysPerWeek: 3 })).toEqual(['test-split']);
    expect(shown({ style: 'strength', daysPerWeek: 6 })).toEqual([]);
    expect(shown({ level: 'beginner', goal: 'lose_fat' })).toEqual(['second-program']);
    expect(
      matchingVariations(TEST_PROGRAM, { ...NO_FILTERS, level: 'advanced' }).map((v) => v.id),
    ).toEqual(['three-balanced', 'three-strength', 'six']);
    expect(
      matchingVariations(TEST_PROGRAM, { ...NO_FILTERS, goal: 'get_stronger', daysPerWeek: 3 }).map(
        (v) => v.id,
      ),
    ).toEqual(['three-balanced', 'three-strength']);
  });

  it('counts the filters set, days a week aside', () => {
    expect(filtersSet(NO_FILTERS)).toBe(0);
    expect(filtersSet({ ...NO_FILTERS, daysPerWeek: 3, goal: 'lose_fat', style: 'strength' })).toBe(
      2,
    );
  });

  it('offers every days-a-week a program has', () => {
    expect(frequencyChoices(programs)).toEqual([3, 4, 6]);
  });

  it('lists the programs by days a week, each on its variation that fits there', () => {
    const sections = frequencySections(programs, NO_FILTERS);
    expect(
      sections.map((section) => ({
        days: section.daysPerWeek,
        entries: section.entries.map((e) => `${e.program.id}:${e.variation.id}`),
      })),
    ).toEqual([
      { days: 3, entries: ['test-split:three-balanced'] },
      { days: 4, entries: ['second-program:four'] },
      { days: 6, entries: ['test-split:six'] },
    ]);
    // A program in two sections; with days set, only that section.
    expect(frequencySections(programs, { ...NO_FILTERS, daysPerWeek: 6 })).toHaveLength(1);
    // A filter that rules a variation out picks the next that fits.
    expect(
      frequencySections(programs, { ...NO_FILTERS, style: 'strength' })[0]!.entries[0]!.variation
        .id,
    ).toBe('three-strength');
    expect(frequencySections(programs, { ...NO_FILTERS, exclusion: 'glutes' })).toEqual([]);
  });

  it('knows what each equipment answer can do', () => {
    expect(equipmentFits('bodyweight', 'dumbbells')).toBe(true);
    expect(equipmentFits('dumbbells', 'full_gym')).toBe(true);
    expect(equipmentFits('full_gym', 'dumbbells')).toBe(false);
    expect(equipmentFits('dumbbells', 'bodyweight')).toBe(false);
  });
});

describe('saying what a variation is', () => {
  it('names it by its focus, or Standard, and its style, equipment and focus', () => {
    expect(variationLabel(variationById(TEST_PROGRAM, 'three-strength'))).toBe('Strength Focus');
    expect(variationLabel(variationById(TEST_PROGRAM, 'six'))).toBe('Standard');
    expect(styleLabel(variationById(TEST_PROGRAM, 'three-strength'))).toBe('Strength');
    expect(equipmentLabel('dumbbells')).toBe('Dumbbells Only');
    const four = defaultVariation(SECOND_PROGRAM);
    expect(focusSummary(four)).toBe('Glutes first · No Direct Chest');
    expect(focusSummary(defaultVariation(TEST_PROGRAM))).toBeNull();
  });

  it('gathers who a program suits from its variations', () => {
    expect(programLevels(SECOND_PROGRAM)).toEqual(['beginner']);
    expect(programLevels(TEST_PROGRAM)).toEqual(['beginner', 'intermediate', 'advanced']);
    expect(
      programLevels({
        ...SECOND_PROGRAM,
        variations: [{ ...defaultVariation(SECOND_PROGRAM), levels: [] }],
      }),
    ).toEqual([]);
  });
});

describe('choosing priorities', () => {
  it('takes up to three in the order tapped, and one tapped again comes off', () => {
    expect(togglePriority([], 'glutes')).toEqual(['glutes']);
    expect(togglePriority(['glutes'], 'back')).toEqual(['glutes', 'back']);
    expect(togglePriority(['glutes', 'back', 'arms'], 'core')).toEqual(['glutes', 'back', 'arms']);
    expect(togglePriority(['glutes', 'back'], 'glutes')).toEqual(['back']);
    expect(priorityFull(['glutes', 'back', 'arms'], 'core')).toBe(true);
    expect(priorityFull(['glutes', 'back', 'arms'], 'back')).toBe(false);
  });

  it('keeps Balanced Development on its own', () => {
    expect(togglePriority(['glutes', 'back'], 'balanced')).toEqual(['balanced']);
    expect(togglePriority(['balanced'], 'chest')).toEqual(['chest']);
    expect(priorityFull(['glutes', 'back', 'arms'], 'balanced')).toBe(false);
  });
});

describe('programProblems', () => {
  it('passes a program written so it can be used', () => {
    expect(programProblems(TEST_PROGRAM)).toEqual([]);
    expect(programProblems(SECOND_PROGRAM)).toEqual([]);
  });

  it('names every problem: an exercise not in use, sets a split day cannot hold, a range backwards, two defaults', () => {
    const base = defaultVariation(SECOND_PROGRAM);
    const broken: WorkoutProgram = {
      ...SECOND_PROGRAM,
      variations: [
        {
          ...base,
          id: 'a',
          schedule: '1-Day',
          daysPerWeek: 1,
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
        { ...base, id: 'b', schedule: '1-Day', daysPerWeek: 1, default: true, days: [] },
      ],
    };
    const problems = programProblems(broken).join('\n');
    expect(problems).toMatch(/bb-behind-the-neck-press isn't an active built-in exercise/);
    expect(problems).toMatch(/sets must be a whole number from 1 to 20/);
    expect(problems).toMatch(/a range must go from its lower number to its higher/);
    expect(problems).toMatch(/alternative nope isn't an active built-in exercise/);
    expect(problems).toMatch(/lists itself as an alternative/);
    expect(problems).toMatch(/variation b has no days/);
    expect(problems).toMatch(/variation b says 1 days a week but has 0/);
    expect(problems).toMatch(/schedule 1-Day has more than one default/);
  });
});

describe('catalogProblems', () => {
  const day = (name: string) => ({
    name,
    muscleGroups: ['chest' as const],
    exercises: [{ slug: 'db-bench-press', sets: 3, reps: 10 }],
  });
  const catalog: CatalogProgram[] = [
    {
      id: 'one',
      name: 'One',
      profile: { categories: ['traditional'], style: 'general', goals: ['build_muscle'] },
      variations: [
        { id: '3-day', daysPerWeek: 3, default: true },
        { id: 'glutes', daysPerWeek: 3, focus: 'Glutes', emphasis: ['glutes'] },
      ],
    },
  ];

  it('passes a catalogue whose content matches it', () => {
    const content: Record<string, ProgramContent> = {
      one: { variations: { '3-day': { days: [day('A'), day('B'), day('C')] } } },
    };
    expect(catalogProblems(catalog, content, assemblePrograms(catalog, content))).toEqual([]);
  });

  it('assembles only the variations written in full, on their own days a week', () => {
    const content: Record<string, ProgramContent> = {
      one: {
        description: 'Words.',
        variations: {
          '3-day': { days: [day('A'), day('B'), day('C')] },
          glutes: { days: [day('A'), { ...day('B'), exercises: [] }, day('C')] },
        },
      },
    };
    const programs = assemblePrograms(catalog, content);
    expect(programs).toHaveLength(1);
    expect(programs[0]!.description).toBe('Words.');
    expect(programs[0]!.variations.map((v) => [v.id, v.daysPerWeek, v.schedule])).toEqual([
      ['3-day', 3, '3-Day'],
    ]);
    // The program's profile, filled in where the catalogue says nothing.
    expect(programs[0]!.variations[0]).toMatchObject({
      style: 'general',
      levels: [],
      equipment: 'full_gym',
      emphasis: [],
      excludes: [],
    });
    expect(assemblePrograms(catalog, {})).toEqual([]);
  });

  it('names content for nothing, days that disagree, a half-written day, and ids repeated', () => {
    const content: Record<string, ProgramContent> = {
      one: {
        variations: {
          '3-day': { days: [day('A'), day('B')] },
          glutes: { days: [day('A'), { ...day('B'), exercises: [] }, day('C')] },
          missing: { days: [day('A')] },
        },
      },
      nobody: { variations: {} },
    };
    const doubled: CatalogProgram[] = [...catalog, { ...catalog[0]!, name: 'One' }];
    const problems = catalogProblems(doubled, content, []).join('\n');
    expect(problems).toMatch(/variation 3-day is 3 days a week, but its content has 2 days/);
    expect(problems).toMatch(/variation glutes has a day with no exercises, so it isn't shown/);
    expect(problems).toMatch(/content for variation missing, which the catalogue hasn't got/);
    expect(problems).toMatch(/nobody: content for a program the catalogue hasn't got/);
    expect(problems).toMatch(/one: is listed twice/);
    expect(problems).toMatch(/the name One is used twice/);
  });
});
