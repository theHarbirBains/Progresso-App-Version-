// Mirrors the public.muscle_group Postgres enum exactly.
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'adductors',
  'glutes',
  'calves',
  'core',
  'full_body',
  'other',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];
