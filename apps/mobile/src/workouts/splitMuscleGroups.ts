// Mirrors the public.split_muscle_group Postgres enum exactly. Deliberately
// separate from exercises/muscleGroups.ts (public.muscle_group): a split
// day's muscle groups are a general, high-level vocabulary meant for quick
// scanning when building/choosing a split -- not the finer per-head
// classification exercises use. Biceps/Triceps/Forearms and
// Quads/Hamstrings/Glutes/Calves are each kept as distinct categories (an
// explicit product decision) rather than merged into one "Arms"/"Legs"
// bucket, while every other region collapses to one general label (e.g.
// front/side/rear delts all become "Shoulders"). Exercise filtering/
// recommendation by muscle group is explicitly deferred, so there is no
// mapping between the two vocabularies yet.
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
  glutes: 'Glutes',
  calves: 'Calves',
};
