import type { Feather } from '@expo/vector-icons';
import { BUILTIN_CATALOG } from '../exercises/illustrations/builtinCatalog.generated';
import type { ProgramExercise, ProgramVariation } from './programTypes';

// Home workouts: what someone has at home (onboarding, Settings > Workout Preferences --
// users.home_equipment), and what a home program's exercises need. An exercise's need is worked
// out from the built-in exercise itself -- its recorded equipment, and a bench, pull-up bar or
// bands where its name says so -- unless the program says otherwise (ProgramExercise.equipment).
// Nothing here is a program: it only decides what's recommended, and marks what someone's
// missing. Every home program can still be browsed.

type Glyph = keyof typeof Feather.glyphMap;

export type HomeEquipment =
  | 'bodyweight'
  | 'dumbbells'
  | 'adjustable_dumbbells'
  | 'barbell'
  | 'bench'
  | 'resistance_bands'
  | 'pull_up_bar'
  | 'cable_machine'
  | 'home_gym'
  | 'other';

/** The question's answers, in its order: No Equipment is an answer on its own. */
export const HOME_EQUIPMENT_OPTIONS: readonly {
  value: HomeEquipment;
  label: string;
  icon: Glyph;
}[] = [
  { value: 'bodyweight', label: 'No Equipment', icon: 'user' },
  { value: 'dumbbells', label: 'Dumbbells', icon: 'disc' },
  { value: 'adjustable_dumbbells', label: 'Adjustable Dumbbells', icon: 'sliders' },
  { value: 'barbell', label: 'Barbell & Weights', icon: 'minus' },
  { value: 'bench', label: 'Bench', icon: 'square' },
  { value: 'resistance_bands', label: 'Resistance Bands', icon: 'link-2' },
  { value: 'pull_up_bar', label: 'Pull-Up Bar', icon: 'chevrons-up' },
  { value: 'cable_machine', label: 'Cable Machine', icon: 'git-commit' },
  { value: 'home_gym', label: 'Home Gym / Multi-Gym', icon: 'home' },
  { value: 'other', label: 'Other Equipment', icon: 'plus-circle' },
];

export const HOME_EQUIPMENT_LABELS = Object.fromEntries(
  HOME_EQUIPMENT_OPTIONS.map((option) => [option.value, option.label]),
) as Record<HomeEquipment, string>;

/** The answers with `item` tapped: No Equipment replaces the rest, and any other replaces it. */
export function toggleHomeEquipment(
  current: readonly HomeEquipment[],
  item: HomeEquipment,
): HomeEquipment[] {
  if (current.includes(item)) return current.filter((owned) => owned !== item);
  if (item === 'bodyweight') return ['bodyweight'];
  return [...current.filter((owned) => owned !== 'bodyweight'), item];
}

/**
 * What one piece of equipment a need asks for: any one of these will do ("dumbbells" -- fixed
 * or adjustable). An exercise's needs are each of these.
 */
export type EquipmentNeed = readonly HomeEquipment[];

const DUMBBELLS: EquipmentNeed = ['dumbbells', 'adjustable_dumbbells'];

/** What a built-in exercise needs at home, worked out from the exercise itself. */
export function builtinNeeds(slug: string): EquipmentNeed[] {
  const entry = BUILTIN_CATALOG[slug];
  if (!entry) return [];
  const name = entry.name.toLowerCase();
  const needs: EquipmentNeed[] = [];
  switch (entry.equipment) {
    case 'dumbbell':
      needs.push(DUMBBELLS);
      break;
    case 'barbell':
      needs.push(['barbell']);
      break;
    case 'cable':
      needs.push(['cable_machine', 'home_gym']);
      break;
    case 'machine':
      needs.push(['home_gym']);
      break;
    case 'kettlebell':
      needs.push(['other']);
      break;
    case 'other':
      needs.push(
        slug.startsWith('bd-') || /\bband\b/.test(name) ? ['resistance_bands'] : ['other'],
      );
      break;
  }
  // What the name says it's done on, beyond the weight itself.
  if (/\b(pull-up|chin-up|hanging)\b/.test(name)) needs.push(['pull_up_bar']);
  if (/\b(bench|incline|decline)\b/.test(name)) needs.push(['bench']);
  // Dips off a bench need only the bench; the rest need bars to dip between.
  if (/\bdips?\b/.test(name) && !/\bbench\b/.test(name) && entry.equipment === 'bodyweight') {
    needs.push(['other']);
  }
  return needs;
}

/** What an exercise of a program needs: the program's own word on it, else the exercise's. */
export function exerciseNeeds(
  exercise: Pick<ProgramExercise, 'slug' | 'equipment'>,
): EquipmentNeed[] {
  return exercise.equipment
    ? exercise.equipment.map((need) => [...need])
    : builtinNeeds(exercise.slug);
}

/** Whether what they have meets a need: any one of its pieces. */
export function meets(need: EquipmentNeed, owned: readonly HomeEquipment[]): boolean {
  return need.some((item) => owned.includes(item));
}

/** The needs an exercise has that what they own doesn't meet; none when they haven't said. */
export function missingFor(
  exercise: Pick<ProgramExercise, 'slug' | 'equipment'>,
  owned: readonly HomeEquipment[],
): EquipmentNeed[] {
  if (owned.length === 0) return [];
  return exerciseNeeds(exercise).filter((need) => !meets(need, owned));
}

/** A need in words: "Dumbbells or Adjustable Dumbbells", "Bench". */
export function needLabel(need: EquipmentNeed): string {
  return need.map((item) => HOME_EQUIPMENT_LABELS[item]).join(' or ');
}

/** Everything a variation's exercises need, each need once, in the order first met. */
export function variationNeeds(variation: Pick<ProgramVariation, 'days'>): EquipmentNeed[] {
  const seen = new Map<string, EquipmentNeed>();
  for (const day of variation.days) {
    for (const exercise of day.exercises) {
      for (const need of exerciseNeeds(exercise)) {
        const key = [...need].sort().join('|');
        if (!seen.has(key)) seen.set(key, need);
      }
    }
  }
  return [...seen.values()];
}

/** Whether what they have does every exercise of a variation. */
export function variationFitsHome(
  variation: Pick<ProgramVariation, 'days'>,
  owned: readonly HomeEquipment[],
): boolean {
  return variationNeeds(variation).every((need) => meets(need, owned));
}
