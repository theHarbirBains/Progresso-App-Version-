import type { MuscleGroup } from '../exercises/muscleGroups';

// Mirrors the public.split_muscle_group Postgres enum exactly. Deliberately
// separate from exercises/muscleGroups.ts (public.muscle_group): a split
// day's muscle groups are a general, high-level vocabulary meant for quick
// scanning when building/choosing a split -- not the finer per-head
// classification exercises use. Biceps/Triceps/Forearms and
// Quads/Hamstrings/Adductors/Glutes/Calves are each kept as distinct
// categories (an explicit product decision) rather than merged into one "Arms"/"Legs"
// bucket, while every other region collapses to one general label (e.g.
// front/side/rear delts all become "Shoulders"). The two meet in one place:
// Add Exercise's previous exercises for a split day's muscle groups
// (EXERCISE_MUSCLE_GROUP_OF, below).
export const SPLIT_MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'quads',
  'hamstrings',
  'adductors',
  'glutes',
  'calves',
] as const;

export type SplitMuscleGroup = (typeof SPLIT_MUSCLE_GROUPS)[number];

export const SPLIT_MUSCLE_GROUP_LABELS: Record<SplitMuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  adductors: 'Adductors',
  glutes: 'Glutes',
  calves: 'Calves',
};

/**
 * The exercise library's muscle group (exercises.muscle_group) a split day's muscle group is:
 * the same name for all but Abs (the library's Core) and Quads (Quadriceps).
 */
export const EXERCISE_MUSCLE_GROUP_OF: Record<SplitMuscleGroup, MuscleGroup> = {
  chest: 'chest',
  back: 'back',
  shoulders: 'shoulders',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearms',
  abs: 'core',
  quads: 'quadriceps',
  hamstrings: 'hamstrings',
  adductors: 'adductors',
  glutes: 'glutes',
  calves: 'calves',
};
