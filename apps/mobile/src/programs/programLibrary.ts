import type { Feather } from '@expo/vector-icons';
import { resolveVariation } from './programAssembly';
import { PROGRAM_CATALOG } from './programCatalog';
import type { ProgramChoice } from './programHost';
import type { ProgramFilters } from './programs';
import { variationMatches } from './programs';
import type { CatalogProgram, ResolvedVariation, WorkoutProgram } from './programTypes';

// Harbir's Workout Split Library, as the Programs tab lists it: his nine sections in his order,
// each title as he wrote it, every one pointing at its program and variations in the catalogue
// (programCatalog.ts) -- one variation per day count the title names. A title shows from the
// start; it opens its program once one of its variations has its programming in
// (programContent.ts), never before. A title can be in more than one section, and two titles can
// be one program (the catalogue says which).

type Glyph = keyof typeof Feather.glyphMap;

/** One title in the library. */
export interface LibraryEntry {
  /** As the list writes it: "Upper / Lower (Chest Emphasis)". */
  title: string;
  /** The catalogue program it is. */
  program: string;
  /** Its variations in that program, one per day count, fewest days first. */
  variations: string[];
}

/** One of the library's sections. */
export interface LibrarySection {
  id: string;
  title: string;
  /** One line under its title. */
  blurb: string;
  icon: Glyph;
  entries: LibraryEntry[];
}

const e = (title: string, program: string, ...variations: string[]): LibraryEntry => ({
  title,
  program,
  variations,
});

export const PROGRAM_LIBRARY: readonly LibrarySection[] = [
  {
    id: 'traditional',
    title: 'Traditional Workout Splits',
    blurb: 'The classic ways to split a training week.',
    icon: 'grid',
    entries: [
      e('Push / Pull / Legs', 'push-pull-legs', '3-day', '6-day'),
      e('Arnold Split', 'arnold-split', '3-day', '6-day'),
      e('Upper / Lower', 'upper-lower', '2-day', '4-day'),
      e('Full Body', 'full-body', '2-day', '3-day', '4-day'),
      e('Bro Split', 'bro-split', '5-day'),
      e('Push / Pull', 'push-pull', '2-day', '4-day'),
      e('Upper / Lower / Full Body', 'upper-lower-full-body', '3-day'),
      e('Push / Pull / Legs / Upper / Lower', 'push-pull-legs-upper-lower', '5-day'),
      e('Torso / Limbs', 'torso-limbs', '4-day'),
      e('Chest & Back / Shoulders & Arms / Legs', 'arnold-split', '3-day', '6-day'),
      e('Upper / Lower / Upper / Full Body', 'upper-lower-upper-full-body', '4-day'),
      e('Full Body A / B', 'full-body', 'ab-2-day', 'ab-3-day'),
      e('Full Body A / B / C', 'full-body', 'abc-3-day'),
      e('Upper / Lower A / B', 'upper-lower', 'ab-4-day'),
      e('Push / Pull / Legs A / B', 'push-pull-legs', 'ab-6-day'),
      e('Upper / Lower / Full Body A / B', 'upper-lower-full-body', 'ab-5-day'),
    ],
  },
  {
    id: 'upper-lower',
    title: 'Upper / Lower Variations',
    blurb: 'Upper / Lower, shaped around what you want to bring up or leave out.',
    icon: 'layers',
    entries: [
      e('Upper / Lower (Balanced Development)', 'upper-lower', 'balanced-development'),
      e('Upper / Lower (Chest Emphasis)', 'upper-lower', 'chest-emphasis'),
      e('Upper / Lower (Back Emphasis)', 'upper-lower', 'back-emphasis'),
      e('Upper / Lower (Shoulder Emphasis)', 'upper-lower', 'shoulder-emphasis'),
      e('Upper / Lower (Arms Emphasis)', 'upper-lower', 'arms-emphasis'),
      e('Upper / Lower (No Chest)', 'upper-lower', 'no-chest'),
      e('Upper / Lower (No Direct Glutes)', 'upper-lower', 'no-direct-glutes'),
      e('Upper / Lower (No Direct Chest or Glutes)', 'upper-lower', 'no-direct-chest-or-glutes'),
      e('Upper / Lower (Back & Arms Emphasis)', 'upper-lower', 'back-arms-emphasis'),
      e('Upper / Lower (Shoulders & Arms Emphasis)', 'upper-lower', 'shoulders-arms-emphasis'),
      e('Upper / Lower (Lower Body Emphasis)', 'upper-lower', 'lower-body-emphasis'),
      e('Upper / Lower (Quad Emphasis)', 'upper-lower', 'quad-emphasis'),
      e('Upper / Lower (Hamstring Emphasis)', 'upper-lower', 'hamstring-emphasis'),
      e('Upper / Lower (Glute Emphasis)', 'upper-lower', 'glute-emphasis'),
      e(
        'Upper / Lower (Chest Emphasis, No Direct Glutes)',
        'upper-lower',
        'chest-emphasis-no-direct-glutes',
      ),
    ],
  },
  {
    id: 'glutes-lower-body',
    title: 'Glute-Focused & Lower-Body Specialization',
    blurb: 'Splits that put glutes and legs first.',
    icon: 'target',
    entries: [
      e('Glutes & Upper Body', 'glutes-upper-body', '3-day'),
      e('Glutes & Legs Focus', 'glutes-legs', '4-day'),
      e('Glute Specialization', 'glute-specialization', '3-day', '4-day', '5-day'),
      e('Glutes & Hamstrings Focus', 'glutes-hamstrings', '4-day'),
      e('Glutes & Quads Focus', 'glutes-quads', '4-day'),
      e('Glutes, Back & Arms', 'glutes-back-arms', '4-day'),
      e('Glutes, Shoulders & Arms', 'glutes-shoulders-arms', '4-day'),
      e('Glutes & Back Emphasis', 'glutes-back', '4-day'),
      e('Lower Body Dominant', 'lower-body-dominant', '4-day'),
      e('Legs & Upper Body (No Chest)', 'legs-upper-body-no-chest', '4-day'),
      e('Glutes, Back & Core', 'glutes-back-core', '4-day'),
      e('Glutes, Legs & Core', 'glutes-legs-core', '4-day'),
      e('Glutes / Upper / Lower', 'glutes-upper-lower', '3-day'),
      e(
        'Glutes / Back & Arms / Legs / Shoulders & Arms',
        'glutes-back-arms-legs-shoulders-arms',
        '4-day',
      ),
      e(
        'Glutes / Back & Biceps / Quads / Hamstrings & Glutes / Shoulders & Arms',
        'glutes-back-biceps-quads-hamstrings-shoulders-arms',
        '5-day',
      ),
      e('Glute-Focused PPL', 'push-pull-legs', 'glute-focused-3-day', 'glute-focused-6-day'),
      e('Glute-Focused Arnold Split', 'arnold-split', 'glute-focused-3-day', 'glute-focused-6-day'),
      e('Lower Body / Upper Body (No Chest)', 'upper-lower', 'no-chest'),
      e('Pilates & Strength Hybrid', 'pilates-strength-hybrid', '4-day'),
      e('Upper Body & Glutes', 'glutes-upper-body', '3-day'),
    ],
  },
  {
    id: 'upper-body-preferences',
    title: 'Upper-Body & Preference-Based Splits',
    blurb: "Upper-body focus, and splits that leave out what you'd rather not train.",
    icon: 'sliders',
    entries: [
      e('Upper / Lower (No Direct Glutes)', 'upper-lower', 'no-direct-glutes'),
      e(
        'Push / Pull / Legs (No Direct Glutes)',
        'push-pull-legs',
        'no-direct-glutes-3-day',
        'no-direct-glutes-6-day',
      ),
      e('Chest & Back Emphasis', 'chest-back-emphasis', '4-day'),
      e('Chest, Shoulders & Arms', 'chest-shoulders-arms', '3-day'),
      e('Back & Arms Emphasis', 'back-arms-emphasis', '3-day'),
      e('Chest & Arms Specialization', 'chest-arms-specialization', '4-day'),
      e('Upper Body Specialization', 'upper-body-specialization', '4-day', '5-day'),
      e('Upper Body Only', 'upper-body-only', '3-day', '4-day', '5-day'),
      e('Chest / Back / Shoulders / Arms', 'chest-back-shoulders-arms', '4-day'),
      e('Chest / Back / Arms', 'chest-back-arms', '3-day'),
      e(
        'Chest & Back / Shoulders & Arms / Legs (No Direct Glutes)',
        'arnold-split',
        'no-direct-glutes-3-day',
        'no-direct-glutes-6-day',
      ),
      e(
        'Arnold Split (No Direct Glutes)',
        'arnold-split',
        'no-direct-glutes-3-day',
        'no-direct-glutes-6-day',
      ),
      e('Bro Split (No Direct Glutes)', 'bro-split', 'no-direct-glutes'),
      e('Push / Pull / Upper (No Direct Glutes)', 'push-pull-upper-no-direct-glutes', '3-day'),
      e(
        'Chest / Back / Shoulders / Arms / Legs (No Direct Glutes)',
        'bro-split',
        'no-direct-glutes',
      ),
      e('Upper Body / Quads & Hamstrings', 'upper-body-quads-hamstrings', '3-day'),
      e(
        'Chest & Triceps / Back & Biceps / Shoulders / Legs',
        'chest-triceps-back-biceps-shoulders-legs',
        '4-day',
      ),
      e('Back & Chest / Arms / Shoulders / Legs', 'back-chest-arms-shoulders-legs', '4-day'),
      e('Back, Shoulders & Arms (No Chest)', 'back-shoulders-arms-no-chest', '3-day'),
    ],
  },
  {
    id: 'muscle-specialization',
    title: 'Muscle Specialization',
    blurb: 'Built around one muscle or area.',
    icon: 'crosshair',
    entries: [
      e('Glute Specialization', 'glute-specialization', '3-day', '4-day', '5-day'),
      e('Quad Specialization', 'quad-specialization', '3-day', '4-day'),
      e('Hamstring Specialization', 'hamstring-specialization', '3-day', '4-day'),
      e('Calf Specialization', 'calf-specialization', '3-day', '4-day'),
      e('Chest Specialization', 'chest-specialization', '3-day', '4-day'),
      e('Back Specialization', 'back-specialization', '3-day', '4-day'),
      e('Shoulder Specialization', 'shoulder-specialization', '3-day', '4-day'),
      e('Biceps Specialization', 'biceps-specialization', '3-day', '4-day'),
      e('Triceps Specialization', 'triceps-specialization', '3-day', '4-day'),
      e('Arm Specialization', 'arm-specialization', '3-day', '4-day'),
      e('Forearm Specialization', 'forearm-specialization', '3-day'),
      e('Core Specialization', 'core-specialization', '3-day', '4-day'),
      e('Upper Body Specialization', 'upper-body-specialization', '4-day', '5-day'),
      e('Lower Body Specialization', 'lower-body-specialization', '4-day', '5-day'),
      e('Posterior Chain Specialization', 'posterior-chain-specialization', '3-day', '4-day'),
      e('Anterior Chain Specialization', 'anterior-chain-specialization', '3-day', '4-day'),
      e('V-Taper Specialization', 'v-taper-specialization', '4-day'),
      e('Back & Shoulder Specialization', 'back-shoulder-specialization', '4-day'),
      e('Chest & Arm Specialization', 'chest-arms-specialization', '4-day'),
    ],
  },
  {
    id: 'strength',
    title: 'Strength Training',
    blurb: 'For getting stronger.',
    icon: 'zap',
    entries: [
      e('Powerlifting Split', 'powerlifting-split', '3-day', '4-day'),
      e('Squat / Bench / Deadlift', 'squat-bench-deadlift', '3-day', '6-day'),
      e('Upper / Lower Strength', 'upper-lower', 'strength'),
      e('Full Body Strength', 'full-body', 'strength'),
      e('Push / Pull Strength', 'push-pull', 'strength'),
      e('Powerbuilding', 'powerbuilding', '4-day', '5-day'),
      e('PHUL', 'phul', '4-day'),
      e('PHAT', 'phat', '5-day'),
      e('5/3/1-Inspired Training', 'five-three-one', '3-day', '4-day'),
      e('StrongLifts-Inspired Full Body', 'stronglifts-full-body', '3-day'),
      e('Starting Strength-Inspired Full Body', 'starting-strength-full-body', '3-day'),
      e('Texas Method-Inspired Training', 'texas-method', '3-day'),
      e('DUP (Daily Undulating Periodization)', 'dup', '3-day', '4-day', '5-day', '6-day'),
      e('Upper / Lower Powerbuilding', 'upper-lower', 'powerbuilding'),
      e('Strength & Hypertrophy Hybrid', 'strength-hypertrophy-hybrid', '4-day', '5-day'),
    ],
  },
  {
    id: 'hypertrophy',
    title: 'Hypertrophy & Bodybuilding',
    blurb: 'For building muscle.',
    icon: 'trending-up',
    entries: [
      e('Classic Bodybuilding Split', 'classic-bodybuilding', '5-day'),
      e('High-Volume PPL', 'push-pull-legs', 'high-volume'),
      e('Low-Volume PPL', 'push-pull-legs', 'low-volume-3-day', 'low-volume-6-day'),
      e('Upper / Lower Hypertrophy', 'upper-lower', 'hypertrophy'),
      e('Arnold Hypertrophy Split', 'arnold-split', 'hypertrophy'),
      e('Bro Split Hypertrophy', 'bro-split', 'hypertrophy'),
      e('Full Body Hypertrophy', 'full-body', 'hypertrophy'),
      e('Torso / Limbs Hypertrophy', 'torso-limbs', 'hypertrophy'),
      e(
        'Push / Pull / Legs Hypertrophy',
        'push-pull-legs',
        'hypertrophy-3-day',
        'hypertrophy-6-day',
      ),
      e('Chest & Back / Legs / Arms & Shoulders', 'chest-back-legs-arms-shoulders', '4-day'),
      e('Upper / Lower / Arms', 'upper-lower-arms', '5-day'),
      e('Chest / Back / Legs / Shoulders / Arms', 'chest-back-legs-shoulders-arms', '5-day'),
      e(
        'High-Frequency Upper / Lower',
        'upper-lower',
        'high-frequency-5-day',
        'high-frequency-6-day',
      ),
      e('High-Frequency Full Body', 'full-body', 'high-frequency-4-day', 'high-frequency-5-day'),
    ],
  },
  {
    id: 'time-efficient',
    title: 'Time-Efficient Training',
    blurb: 'Two to four days a week.',
    icon: 'clock',
    entries: [
      e('Full Body', 'full-body', '2-day', '3-day'),
      e('Upper / Lower', 'upper-lower', '2-day'),
      e('Push / Pull', 'push-pull', '2-day'),
      e('Upper / Lower / Full Body', 'upper-lower-full-body', '3-day'),
      e('Full Body A / B', 'full-body', 'ab-2-day'),
      e('Three-Day Upper / Lower / Full Body', 'upper-lower-full-body', '3-day'),
      e('Three-Day Push / Pull / Legs', 'push-pull-legs', '3-day'),
      e('Four-Day Upper / Lower', 'upper-lower', '4-day'),
      e('Four-Day Torso / Limbs', 'torso-limbs', '4-day'),
      e('Three-Day Upper Body & Lower Body Emphasis', 'upper-body-lower-body-emphasis', '3-day'),
    ],
  },
  {
    id: 'athletic-hybrid',
    title: 'Athletic & Hybrid Training',
    blurb: 'Strength alongside conditioning, sport and bodyweight training.',
    icon: 'wind',
    entries: [
      e('Strength & Conditioning', 'strength-conditioning', '3-day', '4-day'),
      e('Hybrid Athlete', 'hybrid-athlete', '4-day', '5-day'),
      e('Running & Strength Hybrid', 'running-strength-hybrid', '4-day', '5-day'),
      e('Cycling & Strength Hybrid', 'cycling-strength-hybrid', '4-day', '5-day'),
      e('Functional Fitness', 'functional-fitness', '3-day', '4-day', '5-day'),
      e('Athletic Performance', 'athletic-performance', '3-day', '4-day', '5-day'),
      e('Full Body Athletic Training', 'full-body', 'athletic'),
      e('Upper / Lower Athletic Training', 'upper-lower', 'athletic'),
      e('Strength & Cardio', 'strength-cardio', '4-day', '5-day'),
      e('Calisthenics PPL', 'calisthenics', 'ppl-3-day', 'ppl-6-day'),
      e('Calisthenics Upper / Lower', 'calisthenics', 'upper-lower'),
      e('Calisthenics Full Body', 'calisthenics', 'full-body'),
      e('Mobility & Strength Hybrid', 'mobility-strength-hybrid', '3-day', '4-day'),
      e('Pilates & Strength Hybrid', 'pilates-strength-hybrid', '4-day'),
    ],
  },
];

/** The library's days-a-week choices, as the list gives them; All is beside them. */
export const LIBRARY_FREQUENCIES: readonly number[] = [2, 3, 4, 5, 6, 7];

/** How many different splits the library names: a title in two sections counts once. */
export const LIBRARY_SPLIT_COUNT = new Set(
  PROGRAM_LIBRARY.flatMap((section) => section.entries.map((entry) => entry.title)),
).size;

/** How many of the library's different titles can be opened: one of their variations written. */
export function readySplitCount(programs: readonly WorkoutProgram[]): number {
  const ready = new Set<string>();
  for (const section of PROGRAM_LIBRARY) {
    for (const entry of section.entries) {
      if (entryChoice(entry, programs) !== null) ready.add(entry.title);
    }
  }
  return ready.size;
}

/** "Upper / Lower (Chest Emphasis)" as its name and the words in brackets after it. */
export function splitTitle(title: string): { name: string; detail: string | null } {
  const match = /^(.*\S)\s+\(([^()]+)\)$/.exec(title);
  return match ? { name: match[1]!, detail: match[2]! } : { name: title, detail: null };
}

/** "3 days", "3 or 6 days", "2, 3 or 4 days". */
export function daysText(days: readonly number[]): string {
  if (days.length === 1) return `${days[0]} ${days[0] === 1 ? 'day' : 'days'}`;
  return `${days.slice(0, -1).join(', ')} or ${days[days.length - 1]} days`;
}

/** An entry's catalogue variations with their whole profiles, in the entry's order (none for
 * an id the catalogue hasn't got -- libraryProblems says so). */
export function entryVariations(
  entry: LibraryEntry,
  catalog: readonly CatalogProgram[] = PROGRAM_CATALOG,
): ResolvedVariation[] {
  const program = catalog.find((p) => p.id === entry.program);
  if (!program) return [];
  return entry.variations.flatMap((id) => {
    const variation = program.variations.find((v) => v.id === id);
    return variation ? [resolveVariation(program, variation)] : [];
  });
}

/** The days a week an entry offers, fewest first. */
export function entryDays(entry: LibraryEntry): number[] {
  return [...new Set(entryVariations(entry).map((v) => v.daysPerWeek))].sort((a, b) => a - b);
}

/** Whether an entry has a variation fitting every filter set (days a week included). */
export function entryMatches(entry: LibraryEntry, filters: ProgramFilters): boolean {
  return entryVariations(entry).some((variation) => variationMatches(variation, filters));
}

/**
 * What tapping an entry opens, or null while none of its variations is written: on the days a
 * week chosen where that variation is ready, else its program's default among them, else its
 * first ready one.
 */
export function entryChoice(
  entry: LibraryEntry,
  programs: readonly WorkoutProgram[],
  daysPerWeek: number | null = null,
): ProgramChoice | null {
  const program = programs.find((p) => p.id === entry.program);
  if (!program) return null;
  const ready = entry.variations.flatMap((id) => {
    const variation = program.variations.find((v) => v.id === id);
    return variation ? [variation] : [];
  });
  if (ready.length === 0) return null;
  const chosen =
    (daysPerWeek !== null ? ready.find((v) => v.daysPerWeek === daysPerWeek) : undefined) ??
    ready.find((v) => v.default) ??
    ready[0]!;
  return { programId: program.id, variationId: chosen.id };
}

/** A library section narrowed to the entries fitting the filters. */
export function librarySections(
  filters: ProgramFilters,
  library: readonly LibrarySection[] = PROGRAM_LIBRARY,
): { section: LibrarySection; entries: LibraryEntry[] }[] {
  return library
    .map((section) => ({
      section,
      entries: section.entries.filter((entry) => entryMatches(entry, filters)),
    }))
    .filter((shown) => shown.entries.length > 0);
}

/**
 * Everything wrong with the library, as a line each: a section or title with no name, a title
 * listed twice in one section, a title pointing at a program or variation the catalogue hasn't
 * got, a title naming two variations of one day count, and a catalogue variation no title lists
 * (it could never be found).
 */
export function libraryProblems(
  library: readonly LibrarySection[] = PROGRAM_LIBRARY,
  catalog: readonly CatalogProgram[] = PROGRAM_CATALOG,
): string[] {
  const problems: string[] = [];
  const listed = new Set<string>();
  const sectionIds = new Set<string>();
  for (const section of library) {
    if (sectionIds.has(section.id)) problems.push(`section ${section.id} is listed twice`);
    sectionIds.add(section.id);
    if (!section.title.trim()) problems.push(`section ${section.id} has no title`);
    if (section.entries.length === 0) problems.push(`section ${section.id} has no titles`);
    const titles = new Set<string>();
    for (const entry of section.entries) {
      const at = `${section.id}: ${entry.title}`;
      if (!entry.title.trim()) problems.push(`${section.id}: a title is empty`);
      if (titles.has(entry.title)) problems.push(`${at} is listed twice`);
      titles.add(entry.title);
      const program = catalog.find((p) => p.id === entry.program);
      if (!program) {
        problems.push(`${at} points at ${entry.program}, which the catalogue hasn't got`);
        continue;
      }
      if (entry.variations.length === 0) problems.push(`${at} names no variations`);
      const days = new Set<number>();
      for (const id of entry.variations) {
        const variation = program.variations.find((v) => v.id === id);
        if (!variation) {
          problems.push(`${at} names ${entry.program}'s ${id}, which the catalogue hasn't got`);
          continue;
        }
        if (days.has(variation.daysPerWeek)) {
          problems.push(`${at} names two ${variation.daysPerWeek}-day variations`);
        }
        days.add(variation.daysPerWeek);
        listed.add(`${program.id}/${id}`);
      }
    }
  }
  for (const program of catalog) {
    for (const variation of program.variations) {
      if (!listed.has(`${program.id}/${variation.id}`)) {
        problems.push(`${program.id}/${variation.id} isn't in the library, so it can't be found`);
      }
    }
  }
  return problems;
}
