import type { Feather } from '@expo/vector-icons';
import { EQUIPMENT_LABELS, type Equipment } from '../exercises/equipment';
import { BUILTIN_CATALOG } from '../exercises/illustrations/builtinCatalog.generated';
import { BUILTIN_GUIDES } from '../exercises/illustrations/builtinGuides.generated';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import type { FitnessGoal } from '../lib/api';
import { FITNESS_GOAL_OPTIONS } from '../onboarding/onboardingOptions';
import {
  SPLIT_MUSCLE_GROUPS,
  SPLIT_MUSCLE_GROUP_LABELS,
  type SplitMuscleGroup,
} from '../workouts/splitMuscleGroups';
import { HOME_EQUIPMENT_OPTIONS } from './homeEquipment';
import { isReadyContent } from './programAssembly';
import { WORKOUT_PROGRAMS } from './programCatalog';
import type {
  Amount,
  CatalogProgram,
  EquipmentAccess,
  GuidanceTopic,
  PriorityArea,
  ProgramContent,
  ProgramExercise,
  ProgramLevel,
  ProgramVariation,
  TrainingExclusion,
  TrainingStyle,
  VariationProfile,
  WorkoutProgram,
} from './programTypes';

// Reading the program catalogue: finding a program and its variations, saying what it is in a
// few words, filtering the library, and checking a program is written so it can be used.

type Glyph = keyof typeof Feather.glyphMap;

export const PROGRAM_LEVELS: readonly ProgramLevel[] = ['beginner', 'intermediate', 'advanced'];

export const PROGRAM_LEVEL_LABELS: Record<ProgramLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

/** What someone can prioritize, in the order onboarding asks it. */
export const PRIORITY_AREAS: readonly PriorityArea[] = [
  'balanced',
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'glutes',
  'core',
];

export const PRIORITY_LABELS: Record<PriorityArea, string> = {
  balanced: 'Balanced Development',
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  glutes: 'Glutes',
  core: 'Core',
};

/** The split muscle groups each area covers -- what its anatomy figure shows. */
export const PRIORITY_GROUPS: Record<PriorityArea, readonly SplitMuscleGroup[]> = {
  balanced: SPLIT_MUSCLE_GROUPS,
  chest: ['chest'],
  back: ['back'],
  shoulders: ['shoulders'],
  arms: ['biceps', 'triceps', 'forearms'],
  legs: ['quads', 'hamstrings', 'adductors', 'calves'],
  glutes: ['glutes'],
  core: ['abs'],
};

/** Which side of the figure shows an area best. */
export const PRIORITY_SIDE: Record<PriorityArea, 'front' | 'back'> = {
  balanced: 'front',
  chest: 'front',
  back: 'back',
  shoulders: 'front',
  arms: 'front',
  legs: 'front',
  glutes: 'back',
  core: 'front',
};

/** The most areas someone prioritizes. */
export const MAX_PRIORITIES = 3;

/**
 * Priorities with `area` tapped: Balanced Development is an answer on its own (it replaces the
 * rest, and any other replaces it), the others go on in the order tapped up to MAX_PRIORITIES
 * (one more is ignored), and one tapped again comes off.
 */
export function togglePriority(
  current: readonly PriorityArea[],
  area: PriorityArea,
): PriorityArea[] {
  if (current.includes(area)) return current.filter((picked) => picked !== area);
  if (area === 'balanced') return ['balanced'];
  const others = current.filter((picked) => picked !== 'balanced');
  return others.length >= MAX_PRIORITIES ? [...others] : [...others, area];
}

/** Whether a tap on `area` would do nothing: already three others picked. */
export function priorityFull(current: readonly PriorityArea[], area: PriorityArea): boolean {
  return (
    !current.includes(area) &&
    area !== 'balanced' &&
    current.filter((picked) => picked !== 'balanced').length >= MAX_PRIORITIES
  );
}

/** Where someone trains, from the most equipment to the least. */
export const EQUIPMENT_ACCESS_OPTIONS: readonly {
  value: EquipmentAccess;
  label: string;
  description: string;
  icon: Glyph;
}[] = [
  {
    value: 'full_gym',
    label: 'Full Gym',
    description: 'Barbells, dumbbells, cables and machines.',
    icon: 'map-pin',
  },
  {
    value: 'dumbbells',
    label: 'Dumbbells Only',
    description: 'A set of dumbbells and a bench, at home or a small gym.',
    icon: 'home',
  },
  {
    value: 'bodyweight',
    label: 'Bodyweight Only',
    description: 'No equipment, or just a bar to pull up on.',
    icon: 'user',
  },
];

// More equipment fits everything less needs.
const EQUIPMENT_RANK: Record<EquipmentAccess, number> = {
  bodyweight: 0,
  dumbbells: 1,
  full_gym: 2,
};

/** Whether a variation needing `need` can be done with `access`. */
export function equipmentFits(need: EquipmentAccess, access: EquipmentAccess): boolean {
  return EQUIPMENT_RANK[need] <= EQUIPMENT_RANK[access];
}

export const TRAINING_EXCLUSIONS: readonly TrainingExclusion[] = ['chest', 'glutes'];

export const TRAINING_EXCLUSION_LABELS: Record<TrainingExclusion, string> = {
  chest: 'No Direct Chest',
  glutes: 'No Direct Glutes',
};

export const TRAINING_STYLES: readonly TrainingStyle[] = [
  'general',
  'bodybuilding',
  'strength',
  'powerbuilding',
  'athletic',
  'hybrid',
  'calisthenics',
];

export const TRAINING_STYLE_LABELS: Record<TrainingStyle, string> = {
  general: 'Traditional',
  bodybuilding: 'Bodybuilding',
  strength: 'Strength',
  powerbuilding: 'Powerbuilding',
  athletic: 'Athletic',
  hybrid: 'Hybrid',
  calisthenics: 'Calisthenics',
};

/** The guidance topics, in the order the Guidance tab lists them. */
export const GUIDANCE_TOPICS: readonly {
  topic: GuidanceTopic;
  title: string;
  summary: string;
  icon: Glyph;
}[] = [
  {
    topic: 'progression',
    title: 'Progression',
    summary: 'How to keep adding weight and reps.',
    icon: 'trending-up',
  },
  {
    topic: 'recovery',
    title: 'Volume & Recovery',
    summary: 'How much to do, and the rest between.',
    icon: 'layers',
  },
  {
    topic: 'exerciseSelection',
    title: 'Exercise Selection',
    summary: 'Why these exercises, and when to swap one.',
    icon: 'sliders',
  },
];

/** Every program, or the one with this id. */
export function programById(id: string | null | undefined): WorkoutProgram | null {
  return WORKOUT_PROGRAMS.find((program) => program.id === id) ?? null;
}

/** The variation shown first: the one marked default, else the first. */
export function defaultVariation(program: WorkoutProgram): ProgramVariation {
  return program.variations.find((variation) => variation.default) ?? program.variations[0]!;
}

/** The variation with this id, or the program's default. */
export function variationById(
  program: WorkoutProgram,
  id: string | null | undefined,
): ProgramVariation {
  return program.variations.find((variation) => variation.id === id) ?? defaultVariation(program);
}

/** One of a program's schedules: its name and note, and how many days a week it trains. */
export interface ProgramSchedule {
  schedule: string;
  note?: string;
  daysPerWeek: number;
}

/** A program's schedules, in the order written. */
export function schedulesOf(program: WorkoutProgram): ProgramSchedule[] {
  const out: ProgramSchedule[] = [];
  for (const variation of program.variations) {
    if (out.some((s) => s.schedule === variation.schedule)) continue;
    const first = variationsOn(program, variation.schedule)[0]!;
    out.push({
      schedule: variation.schedule,
      note: first.scheduleNote,
      daysPerWeek: first.days.length,
    });
  }
  return out;
}

/** The variations on one schedule, its default first. */
export function variationsOn(program: WorkoutProgram, schedule: string): ProgramVariation[] {
  const on = program.variations.filter((variation) => variation.schedule === schedule);
  return [...on.filter((v) => v.default), ...on.filter((v) => !v.default)];
}

/** "3 or 6 days", "4 days", "3, 4 or 5 days". */
export function daysLabel(program: WorkoutProgram): string {
  const counts = [...new Set(schedulesOf(program).map((s) => s.daysPerWeek))].sort((a, b) => a - b);
  if (counts.length === 1) return `${counts[0]} ${counts[0] === 1 ? 'day' : 'days'}`;
  return `${counts.slice(0, -1).join(', ')} or ${counts[counts.length - 1]} days`;
}

/** "Beginner to Advanced", "Intermediate", "Beginner and Advanced". */
export function levelsLabel(levels: readonly ProgramLevel[]): string {
  const indexes = levels.map((level) => PROGRAM_LEVELS.indexOf(level)).sort((a, b) => a - b);
  if (indexes.length === 0) return 'Any level';
  const names = indexes.map((i) => PROGRAM_LEVEL_LABELS[PROGRAM_LEVELS[i]!]);
  if (names.length === 1) return names[0]!;
  const contiguous = indexes.every((value, i) => i === 0 || value === indexes[i - 1]! + 1);
  return contiguous ? `${names[0]} to ${names[names.length - 1]}` : names.join(' and ');
}

/** The level badge on a library card: its first letter of the lowest level ("B", "I", "A"). */
export function levelInitial(levels: readonly ProgramLevel[]): string | null {
  const lowest = PROGRAM_LEVELS.find((level) => levels.includes(level));
  return lowest ? PROGRAM_LEVEL_LABELS[lowest][0]! : null;
}

/** A variation's name among its program's: its focus, or Standard. */
export function variationLabel(variation: ProgramVariation): string {
  return variation.focus ?? 'Standard';
}

/** Everyone a program's variations suit, in level order -- empty when one suits any level. */
export function programLevels(program: WorkoutProgram): ProgramLevel[] {
  if (program.variations.some((variation) => variation.levels.length === 0)) return [];
  const levels = new Set(program.variations.flatMap((variation) => variation.levels));
  return PROGRAM_LEVELS.filter((level) => levels.has(level));
}

/** How a variation trains, in a word ("Bodybuilding"). */
export function styleLabel(variation: ProgramVariation): string {
  return TRAINING_STYLE_LABELS[variation.style];
}

/** Where a variation can be done, from the least it needs ("Dumbbells Only"). */
export function equipmentLabel(need: EquipmentAccess): string {
  return EQUIPMENT_ACCESS_OPTIONS.find((option) => option.value === need)!.label;
}

/** What a variation puts first and leaves out, in a line ("Glutes first · No Direct Chest"), or
 * null for a balanced one that leaves nothing out. */
export function focusSummary(variation: ProgramVariation): string | null {
  const parts: string[] = [];
  if (variation.emphasis.length > 0) {
    parts.push(`${variation.emphasis.map((area) => PRIORITY_LABELS[area]).join(', ')} first`);
  }
  for (const exclusion of variation.excludes) parts.push(TRAINING_EXCLUSION_LABELS[exclusion]);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function amountText(amount: Amount): string {
  return typeof amount === 'number' ? String(amount) : `${amount.min}–${amount.max}`;
}

/** "3 sets · 6–8 reps", "3 sets · 30–45 s", "4 sets". */
export function prescription(exercise: ProgramExercise): string {
  const sets = `${exercise.sets} ${exercise.sets === 1 ? 'set' : 'sets'}`;
  if (exercise.reps !== undefined) {
    const one = typeof exercise.reps === 'number' && exercise.reps === 1;
    return `${sets} · ${amountText(exercise.reps)} ${one ? 'rep' : 'reps'}`;
  }
  if (exercise.seconds !== undefined) return `${sets} · ${amountText(exercise.seconds)} s`;
  return sets;
}

/** "Rest 90 s", "Rest 2 min", "Rest 2 min 30 s". */
export function restLabel(seconds: number): string {
  if (seconds < 60) return `Rest ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `Rest ${minutes} min` : `Rest ${minutes} min ${rest} s`;
}

/** Everything a variation trains, across its days, in the usual order. */
export function variationMuscles(variation: ProgramVariation): SplitMuscleGroup[] {
  const worked = new Set(variation.days.flatMap((day) => day.muscleGroups));
  return SPLIT_MUSCLE_GROUPS.filter((group) => worked.has(group));
}

/** "Chest, Shoulders, Triceps". */
export function musclesText(groups: readonly SplitMuscleGroup[]): string {
  return groups.map((group) => SPLIT_MUSCLE_GROUP_LABELS[group]).join(', ');
}

/** A built-in exercise as a program shows it, from the app's own catalogue -- no network. */
export interface ProgramExerciseInfo {
  name: string;
  /** Its muscle group's name ("Chest"). */
  muscle: string;
  /** The groups it also works. */
  alsoWorks: string[];
  equipment: string;
}

export function exerciseInfo(slug: string): ProgramExerciseInfo | null {
  const entry = BUILTIN_CATALOG[slug];
  if (!entry) return null;
  const label = (group: string) => MUSCLE_GROUP_LABELS[group as MuscleGroup] ?? group;
  return {
    name: entry.name,
    muscle: label(entry.muscle),
    alsoWorks: entry.secondaryGroups.map(label),
    equipment: EQUIPMENT_LABELS[entry.equipment as Equipment] ?? entry.equipment,
  };
}

/** Whether a slug is a built-in in use today (only active built-ins have a guide). */
export function isActiveBuiltin(slug: string): boolean {
  return slug in BUILTIN_CATALOG && slug in BUILTIN_GUIDES;
}

/** The library's filters; null is any. They all apply together, to the same variation. */
export interface ProgramFilters {
  daysPerWeek: number | null;
  level: ProgramLevel | null;
  goal: FitnessGoal | null;
  /** What it puts first; `balanced` is a program that puts nothing first. */
  emphasis: PriorityArea | null;
  style: TrainingStyle | null;
  /** Where they train: a program needing no more than this. */
  equipment: EquipmentAccess | null;
  /** A program that leaves this out. */
  exclusion: TrainingExclusion | null;
}

export const NO_FILTERS: ProgramFilters = {
  daysPerWeek: null,
  level: null,
  goal: null,
  emphasis: null,
  style: null,
  equipment: null,
  exclusion: null,
};

/** How many filters other than days a week are set. */
export function filtersSet(filters: ProgramFilters): number {
  return [
    filters.level,
    filters.goal,
    filters.emphasis,
    filters.style,
    filters.equipment,
    filters.exclusion,
  ].filter((value) => value !== null).length;
}

/** Whether one variation fits every filter set -- a ready one, or a catalogue variation before
 * it's written (programLibrary.ts). */
export function variationMatches(
  variation: Pick<ProgramVariation, keyof VariationProfile | 'daysPerWeek'>,
  filters: ProgramFilters,
): boolean {
  if (filters.daysPerWeek !== null && variation.daysPerWeek !== filters.daysPerWeek) return false;
  if (filters.level && variation.levels.length > 0 && !variation.levels.includes(filters.level)) {
    return false;
  }
  if (filters.goal && !variation.goals.includes(filters.goal)) return false;
  if (filters.emphasis) {
    const fits =
      filters.emphasis === 'balanced'
        ? variation.emphasis.length === 0
        : variation.emphasis.includes(filters.emphasis);
    if (!fits) return false;
  }
  if (filters.style && variation.style !== filters.style) return false;
  if (filters.equipment && !equipmentFits(variation.equipment, filters.equipment)) return false;
  if (filters.exclusion && !variation.excludes.includes(filters.exclusion)) return false;
  return true;
}

/** A program's variations that fit the filters, its default first. */
export function matchingVariations(
  program: WorkoutProgram,
  filters: ProgramFilters,
): ProgramVariation[] {
  const fit = program.variations.filter((variation) => variationMatches(variation, filters));
  return [...fit.filter((v) => v.default), ...fit.filter((v) => !v.default)];
}

export function matchesFilters(program: WorkoutProgram, filters: ProgramFilters): boolean {
  return matchingVariations(program, filters).length > 0;
}

/** The goals a filter can pick, in onboarding's order, with their names. */
export const GOAL_CHOICES = FITNESS_GOAL_OPTIONS.map((option) => ({
  value: option.value,
  label: option.label,
}));

/** The name a split made from this variation gets: the program's, and its schedule's and
 * focus's where it has more than one. */
export function splitNameFor(program: WorkoutProgram, variation: ProgramVariation): string {
  const parts: string[] = [];
  if (schedulesOf(program).length > 1) parts.push(variation.schedule);
  if (variation.focus && variationsOn(program, variation.schedule).length > 1) {
    parts.push(variation.focus);
  }
  return parts.length > 0 ? `${program.name} (${parts.join(', ')})` : program.name;
}

/** Everything wrong with how a program is written, as a line each -- none for one ready to use. */
export function programProblems(program: WorkoutProgram): string[] {
  const problems: string[] = [];
  const where = (rest: string) => problems.push(`${program.id}: ${rest}`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(program.id)) where('id must be lowercase words joined by -');
  if (!program.name.trim()) where('has no name');
  if (program.description !== undefined && !program.description.trim()) {
    where('has an empty description');
  }
  if (program.variations.length === 0) where('has no variations');
  const ids = new Set<string>();
  for (const variation of program.variations) {
    const at = `variation ${variation.id}`;
    if (ids.has(variation.id)) where(`${at} is listed twice`);
    ids.add(variation.id);
    if (variation.days.length === 0) where(`${at} has no days`);
    if (variation.daysPerWeek !== variation.days.length) {
      where(`${at} says ${variation.daysPerWeek} days a week but has ${variation.days.length}`);
    }
    if (variation.days.length > 7) where(`${at} has more than 7 days`);
    variation.days.forEach((day, d) => {
      const dayAt = `${at}, day ${d + 1} (${day.name})`;
      if (!day.name.trim()) where(`${dayAt} has no name`);
      if (day.muscleGroups.length === 0) where(`${dayAt} names no muscle groups`);
      for (const group of day.muscleGroups) {
        if (!SPLIT_MUSCLE_GROUPS.includes(group))
          where(`${dayAt}: "${group}" isn't a muscle group`);
      }
      if (day.exercises.length === 0) where(`${dayAt} has no exercises`);
      for (const exercise of day.exercises) {
        const exAt = `${dayAt}, ${exercise.slug}`;
        if (!isActiveBuiltin(exercise.slug)) where(`${exAt} isn't an active built-in exercise`);
        if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 20) {
          where(`${exAt}: sets must be a whole number from 1 to 20`);
        }
        if (exercise.reps !== undefined && exercise.seconds !== undefined) {
          where(`${exAt} has both reps and seconds`);
        }
        for (const amount of [exercise.reps, exercise.seconds]) {
          if (amount !== undefined && typeof amount !== 'number' && amount.min > amount.max) {
            where(`${exAt}: a range must go from its lower number to its higher`);
          }
        }
        for (const alternative of exercise.alternatives ?? []) {
          if (!isActiveBuiltin(alternative)) {
            where(`${exAt}: alternative ${alternative} isn't an active built-in exercise`);
          }
          if (alternative === exercise.slug) where(`${exAt} lists itself as an alternative`);
        }
        for (const need of exercise.equipment ?? []) {
          if (need.length === 0) where(`${exAt}: an equipment need names nothing`);
          for (const item of need) {
            if (!HOME_EQUIPMENT_OPTIONS.some((option) => option.value === item)) {
              where(`${exAt}: "${item}" isn't home equipment`);
            }
          }
        }
      }
    });
  }
  // One default per schedule at most.
  for (const schedule of schedulesOf(program)) {
    const defaults = program.variations.filter(
      (v) => v.schedule === schedule.schedule && v.default,
    );
    if (defaults.length > 1) where(`schedule ${schedule.schedule} has more than one default`);
  }
  return problems;
}

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Everything wrong with the catalogue and its content, as a line each: ids badly made or
 * repeated, a program or variation listed twice, content for something the catalogue hasn't
 * got, a variation's days a week not its content's, a variation half written (hidden until it's
 * done), and every ready program's programProblems.
 */
export function catalogProblems(
  catalog: readonly CatalogProgram[],
  content: Readonly<Record<string, ProgramContent>>,
  assembled: readonly WorkoutProgram[],
): string[] {
  const problems: string[] = [];
  const programIds = new Set<string>();
  const names = new Set<string>();
  for (const program of catalog) {
    const where = (rest: string) => problems.push(`${program.id}: ${rest}`);
    if (!ID_PATTERN.test(program.id)) where('id must be lowercase words joined by -');
    if (programIds.has(program.id)) where('is listed twice');
    programIds.add(program.id);
    const name = program.name.trim().toLowerCase();
    if (!name) where('has no name');
    if (names.has(name)) where(`the name ${program.name} is used twice`);
    names.add(name);
    if (program.variations.length === 0) where('has no variations');
    if (program.variations.filter((v) => v.default).length > 1) where('has more than one default');
    const variationIds = new Set<string>();
    const kinds = new Set<string>();
    const words = content[program.id];
    for (const variation of program.variations) {
      const at = `variation ${variation.id}`;
      if (!ID_PATTERN.test(variation.id)) where(`${at}: id must be lowercase words joined by -`);
      if (variationIds.has(variation.id)) where(`${at} is listed twice`);
      variationIds.add(variation.id);
      const kind = `${variation.daysPerWeek}|${variation.focus ?? ''}`;
      if (kinds.has(kind)) where(`${at} repeats another variation's days and focus`);
      kinds.add(kind);
      if (
        !Number.isInteger(variation.daysPerWeek) ||
        variation.daysPerWeek < 1 ||
        variation.daysPerWeek > 7
      ) {
        where(`${at}: days a week must be 1 to 7`);
      }
      const made = words?.variations[variation.id];
      if (!made) continue;
      if (made.days.length > 0 && !isReadyContent(made)) {
        where(`${at} has a day with no exercises, so it isn't shown`);
      }
      if (isReadyContent(made) && made.days.length !== variation.daysPerWeek) {
        where(
          `${at} is ${variation.daysPerWeek} days a week, but its content has ${made.days.length} days`,
        );
      }
    }
    for (const id of Object.keys(words?.variations ?? {})) {
      if (!variationIds.has(id)) {
        where(`content for variation ${id}, which the catalogue hasn't got`);
      }
    }
  }
  for (const id of Object.keys(content)) {
    if (!programIds.has(id)) problems.push(`${id}: content for a program the catalogue hasn't got`);
  }
  return [...problems, ...assembled.flatMap(programProblems)];
}
