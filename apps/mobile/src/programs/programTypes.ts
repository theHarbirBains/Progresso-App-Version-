import type { FitnessGoal } from '../lib/api';
import type { SplitMuscleGroup } from '../workouts/splitMuscleGroups';

// Workout programs: ready-made splits with every day's exercises planned, written by hand
// (programCatalog.ts) -- nothing here is generated. A program is a template, not stored user
// data: using one makes an ordinary split of the person's own (programActivation.ts), which they
// can change like any other, and which never changes when the program does.

/** Who a program suits -- the library's experience filter. */
export type ProgramLevel = 'beginner' | 'intermediate' | 'advanced';

/** What a program puts first -- the library's focus filter. */
export type ProgramFocus = 'full_body' | 'upper_body' | 'lower_body' | 'glutes' | 'arms' | 'core';

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
}

/** One day of a program's week. */
export interface ProgramDay {
  /** "Push", "Upper A". */
  name: string;
  /** What the day trains, as a split day records it. */
  muscleGroups: SplitMuscleGroup[];
  exercises: ProgramExercise[];
}

/**
 * One way of running a program: a schedule ("3-Day", "6-Day") and, where the program offers
 * several on one schedule, a focus ("Hypertrophy Focus", "Strength Focus") -- each its own days,
 * written out in full.
 */
export interface ProgramVariation {
  /** Stable within the program. */
  id: string;
  /** The schedule's name, as the Schedule tab's switch shows it ("3-Day"). */
  schedule: string;
  /** A word or two after it ("Standard", "High Volume"). */
  scheduleNote?: string;
  /** Its focus, where the program has more than one on this schedule ("Balanced"). */
  focus?: string;
  /** A line on the focus ("Higher volume, moderate reps (8-15)"). */
  focusNote?: string;
  /** The one shown first, on its schedule (and the program's first schedule shown first). */
  default?: boolean;
  /** A line under the schedule ("The 3-day version is a balanced approach..."). */
  note?: string;
  days: ProgramDay[];
}

/** The guidance topics every program's Guidance tab has. */
export type GuidanceTopic = 'progression' | 'recovery' | 'exerciseSelection';

export interface WorkoutProgram {
  /** Stable and unique ("push-pull-legs"): kept in drafts and links. */
  id: string;
  name: string;
  /** A word after the days in lists ("Balanced", "Bodybuilding"). */
  style: string;
  /** The Overview's paragraph. */
  description: string;
  levels: ProgramLevel[];
  /** Onboarding's fitness goals it suits -- the library's goal filter. */
  goals: FitnessGoal[];
  focuses: ProgramFocus[];
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
