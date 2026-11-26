import { TEST_PROGRAM } from './__fixtures__/programs';
import {
  builtinNeeds,
  exerciseNeeds,
  HOME_EQUIPMENT_OPTIONS,
  missingFor,
  needLabel,
  toggleHomeEquipment,
  variationFitsHome,
  variationNeeds,
} from './homeEquipment';
import { NO_PREFERENCES, recommendPrograms, scoreVariation } from './recommendations';
import type { ProgramVariation, WorkoutProgram } from './programTypes';

describe('home equipment', () => {
  it('asks the ten answers, in order', () => {
    expect(HOME_EQUIPMENT_OPTIONS.map((option) => option.label)).toEqual([
      'No Equipment',
      'Dumbbells',
      'Adjustable Dumbbells',
      'Barbell & Weights',
      'Bench',
      'Resistance Bands',
      'Pull-Up Bar',
      'Cable Machine',
      'Home Gym / Multi-Gym',
      'Other Equipment',
    ]);
  });

  it('takes several, with No Equipment an answer of its own', () => {
    expect(toggleHomeEquipment([], 'dumbbells')).toEqual(['dumbbells']);
    expect(toggleHomeEquipment(['dumbbells'], 'bench')).toEqual(['dumbbells', 'bench']);
    expect(toggleHomeEquipment(['dumbbells', 'bench'], 'bodyweight')).toEqual(['bodyweight']);
    expect(toggleHomeEquipment(['bodyweight'], 'pull_up_bar')).toEqual(['pull_up_bar']);
    expect(toggleHomeEquipment(['dumbbells', 'bench'], 'bench')).toEqual(['dumbbells']);
  });

  it('works out what a built-in needs from the exercise itself', () => {
    expect(builtinNeeds('db-bench-press')).toEqual([
      ['dumbbells', 'adjustable_dumbbells'],
      ['bench'],
    ]);
    expect(builtinNeeds('db-curl')).toEqual([['dumbbells', 'adjustable_dumbbells']]);
    expect(builtinNeeds('bb-bench-press')).toEqual([['barbell'], ['bench']]);
    expect(builtinNeeds('bw-pull-up')).toEqual([['pull_up_bar']]);
    expect(builtinNeeds('bw-hanging-leg-raise')).toEqual([['pull_up_bar']]);
    expect(builtinNeeds('bw-bench-dip')).toEqual([['bench']]);
    expect(builtinNeeds('bw-chest-dip')).toEqual([['other']]);
    expect(builtinNeeds('db-incline-bench-press')).toEqual([
      ['dumbbells', 'adjustable_dumbbells'],
      ['bench'],
    ]);
    expect(builtinNeeds('not-a-built-in')).toEqual([]);
  });

  it("takes the program's own word on an exercise over the built-in's", () => {
    expect(exerciseNeeds({ slug: 'db-curl', equipment: [['resistance_bands']] })).toEqual([
      ['resistance_bands'],
    ]);
  });

  it("says what they're missing -- nothing when they haven't said what they have", () => {
    const press = { slug: 'db-bench-press' };
    expect(missingFor(press, [])).toEqual([]);
    expect(missingFor(press, ['adjustable_dumbbells'])).toEqual([['bench']]);
    expect(missingFor(press, ['dumbbells', 'bench'])).toEqual([]);
    expect(needLabel(['dumbbells', 'adjustable_dumbbells'])).toBe(
      'Dumbbells or Adjustable Dumbbells',
    );
  });
});

describe('home programs, recommended from what someone has', () => {
  // A home program: a dumbbell bench press, pull-ups and push-ups.
  const homeVariation: ProgramVariation = {
    ...TEST_PROGRAM.variations[0]!,
    id: 'home-3',
    equipment: 'dumbbells',
    days: [
      {
        name: 'Upper',
        muscleGroups: ['chest', 'back'],
        exercises: [
          { slug: 'db-bench-press', sets: 3, reps: 10 },
          { slug: 'bw-pull-up', sets: 3, reps: 8 },
          { slug: 'bw-push-up', sets: 3, reps: 15 },
        ],
      },
      { name: 'Lower', muscleGroups: ['quads'], exercises: [{ slug: 'db-goblet-squat', sets: 3 }] },
      { name: 'Full', muscleGroups: ['chest'], exercises: [{ slug: 'bw-push-up', sets: 3 }] },
    ],
  };
  const HOME: WorkoutProgram = {
    ...TEST_PROGRAM,
    id: 'home-split',
    name: 'Home Split',
    setting: 'home',
    variations: [homeVariation],
  };

  it('needs what its exercises need, each once', () => {
    expect(variationNeeds(homeVariation)).toEqual([
      ['dumbbells', 'adjustable_dumbbells'],
      ['bench'],
      ['pull_up_bar'],
    ]);
    expect(variationFitsHome(homeVariation, ['dumbbells', 'bench', 'pull_up_bar'])).toBe(true);
    expect(variationFitsHome(homeVariation, ['dumbbells', 'bench'])).toBe(false);
  });

  it('recommends one that uses what they have, and never one needing what they lack', () => {
    const has = {
      ...NO_PREFERENCES,
      homeEquipment: ['adjustable_dumbbells' as const, 'bench' as const, 'pull_up_bar' as const],
    };
    expect(scoreVariation(homeVariation, has, 'home')?.reasons).toContain(
      'Uses what you have at home',
    );
    expect(
      scoreVariation(homeVariation, { ...NO_PREFERENCES, homeEquipment: ['dumbbells'] }, 'home'),
    ).toBeNull();
    // Not said: still recommended from the rest.
    expect(
      scoreVariation(homeVariation, { ...NO_PREFERENCES, daysPerWeek: 3 }, 'home'),
    ).not.toBeNull();
  });

  it('keeps gym and home recommendations apart where asked', () => {
    const prefs = { ...NO_PREFERENCES, daysPerWeek: 3 };
    const both = [TEST_PROGRAM, HOME];
    expect(recommendPrograms(both, prefs, 3, 'home').map((r) => r.program.id)).toEqual([
      'home-split',
    ]);
    expect(recommendPrograms(both, prefs, 3, 'gym').map((r) => r.program.id)).toEqual([
      'test-split',
    ]);
  });
});
