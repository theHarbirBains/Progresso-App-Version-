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
import { WORKOUT_PROGRAMS } from './programCatalog';
import type {
  Amount,
  GuidanceTopic,
  ProgramExercise,
  ProgramFocus,
  ProgramLevel,
  ProgramVariation,
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

export const PROGRAM_FOCUSES: readonly ProgramFocus[] = [
  'full_body',
  'upper_body',
  'lower_body',
  'glutes',
  'arms',
  'core',
];

export const PROGRAM_FOCUS_LABELS: Record<ProgramFocus, string> = {
  full_body: 'Full Body',
  upper_body: 'Upper Body',
  lower_body: 'Lower Body',
  glutes: 'Glutes',
  arms: 'Arms',
  core: 'Core',
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

/** The library's filters; null is any. */
export interface ProgramFilters {
  level: ProgramLevel | null;
  daysPerWeek: number | null;
  focus: ProgramFocus | null;
  goal: FitnessGoal | null;
}

export const NO_FILTERS: ProgramFilters = {
  level: null,
  daysPerWeek: null,
  focus: null,
  goal: null,
};

export function matchesFilters(program: WorkoutProgram, filters: ProgramFilters): boolean {
  if (filters.level && !program.levels.includes(filters.level)) return false;
  if (filters.focus && !program.focuses.includes(filters.focus)) return false;
  if (filters.goal && !program.goals.includes(filters.goal)) return false;
  if (
    filters.daysPerWeek !== null &&
    !schedulesOf(program).some((s) => s.daysPerWeek === filters.daysPerWeek)
  ) {
    return false;
  }
  return true;
}

/** The days-a-week a filter can pick: every schedule's in the catalogue, fewest first. */
export function frequencyChoices(programs: readonly WorkoutProgram[]): number[] {
  return [...new Set(programs.flatMap((p) => schedulesOf(p).map((s) => s.daysPerWeek)))].sort(
    (a, b) => a - b,
  );
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
  if (!program.description.trim()) where('has no description');
  if (program.levels.length === 0) where('names no level');
  if (program.variations.length === 0) where('has no variations');
  const ids = new Set<string>();
  for (const variation of program.variations) {
    const at = `variation ${variation.id}`;
    if (ids.has(variation.id)) where(`${at} is listed twice`);
    ids.add(variation.id);
    if (variation.days.length === 0) where(`${at} has no days`);
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
