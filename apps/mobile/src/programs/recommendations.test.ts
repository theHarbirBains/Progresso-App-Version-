import { SECOND_PROGRAM, TEST_PROGRAM } from './__fixtures__/programs';
import { preferencesFrom, preferencesFromProfile } from './programPreferences';
import type { ProgramVariation, WorkoutProgram } from './programTypes';
import {
  bestVariation,
  hasPreferences,
  NO_PREFERENCES,
  recommendPrograms,
  scoreVariation,
  type ProgramPreferences,
} from './recommendations';

const prefs = (patch: Partial<ProgramPreferences>): ProgramPreferences => ({
  ...NO_PREFERENCES,
  ...patch,
});

// A program of one variation, its profile changed where given.
function single(id: string, patch: Partial<ProgramVariation>): WorkoutProgram {
  const base = TEST_PROGRAM.variations[0]!;
  const days = Array.from({ length: patch.daysPerWeek ?? 3 }, (_, i) => base.days[i % 3]!);
  return {
    id,
    name: id,
    variations: [{ ...base, id: 'v', default: true, ...patch, days }],
  };
}

describe('recommendPrograms', () => {
  it('recommends nothing with nothing to go on', () => {
    expect(hasPreferences(NO_PREFERENCES)).toBe(false);
    expect(recommendPrograms([TEST_PROGRAM, SECOND_PROGRAM], NO_PREFERENCES)).toEqual([]);
  });

  it('puts their days a week first: never more days than they have', () => {
    const three = recommendPrograms([TEST_PROGRAM, SECOND_PROGRAM], prefs({ daysPerWeek: 3 }));
    expect(three.map((r) => `${r.program.id}:${r.variation.id}`)).toEqual([
      'test-split:three-balanced',
    ]);
    expect(three[0]!.reasons).toContain('Fits your 3 days a week');
    // One fewer fits, counted for less.
    const five = recommendPrograms([TEST_PROGRAM, SECOND_PROGRAM], prefs({ daysPerWeek: 5 }));
    expect(five.map((r) => r.program.id)).toEqual(['second-program']);
    expect(five[0]!.reasons).toContain('4 days a week');
    // 1-2 days a week reads as 2.
    expect(
      scoreVariation(single('two', { daysPerWeek: 2 }).variations[0]!, prefs({ daysPerWeek: 1 })),
    ).not.toBeNull();
  });

  it('weighs the main goal over the others', () => {
    const muscle = single('muscle', { goals: ['build_muscle'] });
    const strength = single('strength', { goals: ['get_stronger'] });
    const order = recommendPrograms(
      [strength, muscle],
      prefs({ goals: ['build_muscle', 'get_stronger'] }),
    );
    expect(order.map((r) => r.program.id)).toEqual(['muscle', 'strength']);
    expect(order[0]!.reasons).toContain('Built for muscle');
  });

  it('puts what they prioritize first, and Balanced Development for balanced programs', () => {
    const glutes = single('glutes', { emphasis: ['glutes'] });
    const chestBack = single('chest-back', { emphasis: ['chest', 'back'] });
    const balanced = single('balanced', { emphasis: [] });
    const forGlutes = recommendPrograms(
      [balanced, chestBack, glutes],
      prefs({ priorities: ['glutes'] }),
    );
    expect(forGlutes[0]!.program.id).toBe('glutes');
    expect(forGlutes[0]!.reasons).toContain('Puts Glutes first');
    const both = recommendPrograms(
      [glutes, chestBack, balanced],
      prefs({ priorities: ['chest', 'back'] }),
    );
    expect(both[0]!.program.id).toBe('chest-back');
    expect(both[0]!.reasons).toContain('Puts Chest and Back first');
    const forBalanced = recommendPrograms(
      [glutes, chestBack, balanced],
      prefs({ priorities: ['balanced'] }),
    );
    expect(forBalanced[0]!.program.id).toBe('balanced');
    expect(forBalanced[0]!.reasons).toContain('Balanced development');
  });

  it('suggests what leaves out what they would rather not train, and never what puts it first', () => {
    const noChest = single('no-chest', { excludes: ['chest'] });
    const chestFirst = single('chest-first', { emphasis: ['chest'] });
    const plain = single('plain', {});
    const order = recommendPrograms([plain, chestFirst, noChest], prefs({ exclusions: ['chest'] }));
    expect(order.map((r) => r.program.id)).toEqual(['no-chest', 'plain']);
    expect(order[0]!.reasons).toContain('No Direct Chest');
    // Never one that leaves out what they put first.
    const noGlutes = single('no-glutes', { excludes: ['glutes'] });
    expect(recommendPrograms([noGlutes], prefs({ priorities: ['glutes'] }))).toEqual([]);
  });

  it('keeps to their equipment and their level', () => {
    const gym = single('gym', { equipment: 'full_gym' });
    const dumbbells = single('dumbbells', { equipment: 'dumbbells' });
    const order = recommendPrograms([gym, dumbbells], prefs({ equipment: 'dumbbells' }));
    expect(order.map((r) => r.program.id)).toEqual(['dumbbells']);
    expect(order[0]!.reasons).toContain('Dumbbells only');
    const advanced = single('advanced', { levels: ['advanced'] });
    const anyLevel = single('any', { levels: [] });
    expect(
      recommendPrograms([advanced, anyLevel], prefs({ level: 'beginner' })).map(
        (r) => r.program.id,
      ),
    ).toEqual(['any']);
  });

  it('counts a session length that fits, and against one that runs long', () => {
    const short = single('short', { sessionMinutes: { min: 30, max: 45 } });
    const long = single('long', { sessionMinutes: { min: 75, max: 90 } });
    const order = recommendPrograms(
      [long, short],
      prefs({ sessionMinutes: { min: 30, max: 45 }, daysPerWeek: 3 }),
    );
    expect(order.map((r) => r.program.id)).toEqual(['short', 'long']);
    expect(order[0]!.reasons).toContain('30-45 min sessions');
  });

  it('recommends each program once, on its variation that fits best, at most three', () => {
    expect(bestVariation(TEST_PROGRAM, prefs({ daysPerWeek: 6 }))?.variation.id).toBe('six');
    // The strength focus is for intermediate and advanced lifters.
    expect(
      TEST_PROGRAM.variations
        .filter((v) => scoreVariation(v, prefs({ level: 'beginner' })) !== null)
        .map((v) => v.id),
    ).toEqual(['three-balanced', 'six']);
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => single(id, {}));
    const shown = recommendPrograms(many, prefs({ goals: ['build_muscle'] }));
    expect(shown.map((r) => r.program.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('preferences from the answers given', () => {
  it('reads onboarding answers as what recommendations need', () => {
    expect(
      preferencesFrom({
        workoutFrequencyDays: 4,
        trainingComfort: 'plans_and_progresses',
        fitnessGoals: ['build_muscle'],
        averageWorkoutLength: '45_60',
        trainingPriorities: ['glutes'],
        equipmentAccess: 'dumbbells',
        trainingExclusions: ['chest'],
      }),
    ).toEqual({
      daysPerWeek: 4,
      level: 'intermediate',
      goals: ['build_muscle'],
      priorities: ['glutes'],
      equipment: 'dumbbells',
      exclusions: ['chest'],
      sessionMinutes: { min: 45, max: 60 },
    });
  });

  it("falls back on an older account's experience, and reads no profile as nothing", () => {
    expect(
      preferencesFromProfile({
        workoutFrequencyDays: null,
        trainingComfort: null,
        trainingExperience: 'advanced',
        fitnessGoals: [],
        averageWorkoutLength: null,
        trainingPriorities: [],
        equipmentAccess: null,
        trainingExclusions: [],
      } as never).level,
    ).toBe('advanced');
    expect(preferencesFromProfile(null)).toEqual(NO_PREFERENCES);
  });
});
