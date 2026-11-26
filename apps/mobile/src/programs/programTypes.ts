import type { FitnessGoal } from '../lib/api';
import type { SplitMuscleGroup } from '../workouts/splitMuscleGroups';
import type { HomeEquipment } from './homeEquipment';

// Workout programs: ready-made splits with every day's exercises planned, written by hand --
// nothing here is generated. A program is a template, not stored user data: using one makes an
// ordinary split of the person's own (programActivation.ts), which they can change like any other,
// and which never changes when the program does.
//
// Two parts: the catalogue (programCatalog.ts) says what each program and its variations are --
// days a week, emphasis, what they leave out, equipment, style, goals, level -- and the content
// (programContent.ts) is the programming itself: each variation's days, exercises, sets and reps,
// and the program's words. A variation shows only once its content is in (programAssembly.ts).

/** Who a program suits -- the experience filter. */
export type ProgramLevel = 'beginner' | 'intermediate' | 'advanced';

/** The kinds of program, as the catalogue groups them. A variation can be several. */
export type ProgramCategory =
  | 'traditional'
  | 'upper_lower'
  | 'specialization'
  | 'strength'
  | 'hypertrophy'
  | 'time_efficient'
  | 'athletic';

/** The areas someone can prioritize (onboarding's question) and a program can emphasize. */
export type PriorityArea =
  'balanced' | 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'glutes' | 'core';

/** Where someone trains -- and the least a program needs: a full gym, dumbbells, or nothing. */
export type EquipmentAccess = 'full_gym' | 'dumbbells' | 'bodyweight';

/** Whether a program's for a gym or for home (the library's Gym | Home switch). */
export type ProgramSetting = 'gym' | 'home';

/** What someone would rather not train directly, and a program leaves out. */
export type TrainingExclusion = 'chest' | 'glutes';

/** How a program trains -- the style filter. */
export type TrainingStyle =
  | 'general'
  | 'bodybuilding'
  | 'strength'
  | 'powerbuilding'
  | 'athletic'
  | 'calisthenics'
  | 'hybrid';

/** A number, or a range from `min` to `max`. */
export type Amount = number | { min: number; max: number };

/** One exercise of a program's day, as it's planned. */
export interface ProgramExercise {
  /** The built-in exercise (`exercises.slug`, BUILTIN_CATALOG). Programs use built-ins only, which
   * everyone has. */
  slug: string;
  /** Sets planned (1-20, as a split day's plan takes). */
  sets: number;
  /** Reps a set, for an exercise done in reps. */
  reps?: Amount;
  /** Seconds a set, for a timed exercise (a hold, a carry). */
  seconds?: Amount;
  /** Rest between sets, in seconds. */
  restSeconds?: number;
  /** One line under the exercise ("Last set to failure"). */
  note?: string;
  /** This program's own tips for it, shown before the exercise's Key Tips. */
  tips?: string[];
  /** Built-ins that can stand in for it (slugs), in the order offered. */
  alternatives?: string[];
  /**
   * What it needs at home, where the program says so: each need any one of its pieces
   * ([['dumbbells', 'adjustable_dumbbells'], ['bench']]). Otherwise it's worked out from the
   * built-in exercise (homeEquipment.ts).
   */
  equipment?: HomeEquipment[][];
}

/** One day of a program's week. */
export interface ProgramDay {
  /** "Push", "Upper A". */
  name: string;
  /** What the day trains, as a split day records it. */
  muscleGroups: SplitMuscleGroup[];
  exercises: ProgramExercise[];
}

/** What a variation is, whatever its programming: what the filters and recommendations read. */
export interface VariationProfile {
  categories: ProgramCategory[];
  style: TrainingStyle;
  /** Onboarding's fitness goals it suits. */
  goals: FitnessGoal[];
  /** Who it suits; empty for any level. */
  levels: ProgramLevel[];
  /** The least it needs. */
  equipment: EquipmentAccess;
  /** What it puts first; empty for balanced development. */
  emphasis: PriorityArea[];
  /** What it leaves out on purpose (no direct chest or glute work). */
  excludes: TrainingExclusion[];
}

/**
 * One way of running a program, ready to use: a schedule ("3-Day", "6-Day") and, where the
 * program offers several, a focus ("Glute-Focused", "No Direct Glutes") -- its own days, written
 * out in full.
 */
export interface ProgramVariation extends VariationProfile {
  /** Stable within the program. */
  id: string;
  /** Days a week: its days. */
  daysPerWeek: number;
  /** The schedule's name, as the Schedule tab's switch shows it ("3-Day"). */
  schedule: string;
  /** A word or two after it ("Standard", "High Volume"). */
  scheduleNote?: string;
  /** Its focus, where the program has more than one ("Glute-Focused"). */
  focus?: string;
  /** A line on the focus ("Higher volume, moderate reps (8-15)"). */
  focusNote?: string;
  /** The one shown first, on its schedule (and the program's first schedule shown first). */
  default?: boolean;
  /** A line under the schedule ("The 3-day version is a balanced approach..."). */
  note?: string;
  /** About how long a session takes, in minutes. */
  sessionMinutes?: { min: number; max: number };
  days: ProgramDay[];
}

/** The guidance topics every program's Guidance tab has. */
export type GuidanceTopic = 'progression' | 'recovery' | 'exerciseSelection';

/** A program as the app shows it: only its variations that are ready (programAssembly.ts). */
export interface WorkoutProgram {
  /** Stable and unique ("push-pull-legs"): kept in drafts and links. */
  id: string;
  name: string;
  /** For a gym (the default) or for home. */
  setting?: ProgramSetting;
  /** The Overview's paragraph. */
  description?: string;
  /** Pills under the name ("Hypertrophy", "Strength"). */
  tags?: string[];
  /** A badge over the name ("Popular"). */
  badge?: string;
  /** "Why choose this split?" -- a line each. */
  benefits?: string[];
  variations: ProgramVariation[];
  /** The program's own words on each guidance topic, paragraph by paragraph. */
  guidance?: Partial<Record<GuidanceTopic, string[]>>;
}

// ---- The catalogue: what each program and variation is -----------------------------------------

/** A variation in the catalogue: its days a week, its focus, and how it differs from its
 * program's profile. */
export interface CatalogVariation extends Partial<VariationProfile> {
  id: string;
  /** Days a week, as the library names it; its content must have this many days. */
  daysPerWeek: number;
  focus?: string;
  default?: boolean;
}

/** A catalogue variation with its whole profile worked out (its program's, changed where it says
 * so) -- what the library's filters read before anything is written. */
export interface ResolvedVariation extends VariationProfile {
  id: string;
  daysPerWeek: number;
  focus?: string;
  default?: boolean;
}

/** A parent program in the catalogue: its profile, which each variation can change. */
export interface CatalogProgram {
  id: string;
  name: string;
  /** For a gym (the default) or for home: the library's Gym | Home switch. */
  setting?: ProgramSetting;
  profile: Pick<VariationProfile, 'categories' | 'style' | 'goals'> &
    Partial<Omit<VariationProfile, 'categories' | 'style' | 'goals'>>;
  variations: CatalogVariation[];
}

// ---- The content: the programming itself, by program and variation id -------------------------

/** A variation's programming. */
export interface VariationContent {
  days: ProgramDay[];
  scheduleNote?: string;
  focusNote?: string;
  note?: string;
  sessionMinutes?: { min: number; max: number };
}

/** A program's content: its words, and each variation's programming. */
export interface ProgramContent {
  description?: string;
  tags?: string[];
  badge?: string;
  benefits?: string[];
  guidance?: Partial<Record<GuidanceTopic, string[]>>;
  variations: Record<string, VariationContent>;
}
