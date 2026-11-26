import { BUILTIN_CATALOG } from './illustrations/builtinCatalog.generated';
import { regionsOf, sideOf } from './illustrations/muscleMap';
import { REGION_GROUP } from './illustrations/muscles';
import { matchesExerciseSearch } from './exerciseQueries';
import {
  MOVEMENT_CATEGORIES,
  knownMovementPatterns,
  matchesMovement,
  movementCategoryOf,
  movementPatternLabel,
} from './movementCategories';
import { MUSCLE_GROUPS } from './muscleGroups';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

describe('movement categories', () => {
  it('places every built-in by its own movement pattern -- none is left without one', () => {
    const unplaced = Object.entries(BUILTIN_CATALOG)
      .filter(([, entry]) => movementCategoryOf(entry.pattern) === null)
      .map(([slug, entry]) => `${slug} (${entry.pattern})`);
    expect(unplaced).toEqual([]);
  });

  it('has a built-in in every category, and names no pattern the catalogue lacks', () => {
    const patterns = new Set(Object.values(BUILTIN_CATALOG).map((entry) => entry.pattern));
    for (const category of MOVEMENT_CATEGORIES) {
      expect([...patterns].some((pattern) => movementCategoryOf(pattern) === category)).toBe(true);
    }
    expect(knownMovementPatterns().filter((pattern) => !patterns.has(pattern))).toEqual([]);
  });

  it('sorts the obvious ones where a person would look for them', () => {
    expect(movementCategoryOf('horizontal_push')).toBe('push');
    expect(movementCategoryOf('vertical_pull')).toBe('pull');
    expect(movementCategoryOf('hip_extension')).toBe('hinge');
    expect(movementCategoryOf('curl')).toBe('isolation');
    expect(movementCategoryOf('anti_extension')).toBe('core');
    expect(movementCategoryOf('carry')).toBe('carry_hold');
    expect(movementCategoryOf(null)).toBeNull();
    expect(movementCategoryOf('something_new')).toBeNull();
  });

  it('matches every exercise with none chosen, and only that movement once one is', () => {
    expect(matchesMovement({ movementPattern: null }, null)).toBe(true);
    expect(matchesMovement({ movementPattern: 'squat' }, 'squat')).toBe(true);
    expect(matchesMovement({ movementPattern: 'lunge' }, 'squat')).toBe(false);
    // A person's own exercise records no movement, so it's under All Movements only.
    expect(matchesMovement({}, 'push')).toBe(false);
  });

  it('names a pattern in words', () => {
    expect(movementPatternLabel('horizontal_pull')).toBe('Horizontal Pull');
    expect(movementPatternLabel('anti_extension')).toBe('Anti-Extension');
    expect(movementPatternLabel(null)).toBeNull();
  });

  it('finds exercises by their movement category in search, with their other words', () => {
    const rdl = {
      name: 'Romanian Deadlift',
      movementPattern: 'hinge',
      equipment: 'barbell' as const,
    };
    const curl = { name: 'Dumbbell Curl', movementPattern: 'curl', equipment: 'dumbbell' as const };
    expect(matchesExerciseSearch(rdl, 'hinge barbell')).toBe(true);
    expect(matchesExerciseSearch(curl, 'hinge')).toBe(false);
    expect(matchesExerciseSearch(curl, 'isolation db')).toBe(true);
  });
});

describe('a muscle group on the anatomy figure', () => {
  it('shows each muscle group from the side it is on', () => {
    expect(sideOf('back')).toBe('back');
    expect(sideOf('hamstrings')).toBe('back');
    expect(sideOf('chest')).toBe('front');
    expect(regionsOf('other')).toEqual([]);
  });

  it('gives every muscle on the figure to one of the app’s muscle groups', () => {
    for (const group of MUSCLE_GROUPS.filter((g) => g !== 'full_body')) {
      for (const region of regionsOf(group)) expect(REGION_GROUP[region]).toBe(group);
    }
  });
});
