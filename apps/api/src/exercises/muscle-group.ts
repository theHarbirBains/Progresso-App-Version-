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

/** The groups an exercise can also work (exercises.secondary_muscle_groups) -- never Full Body or Other. */
export const SECONDARY_MUSCLE_GROUPS = MUSCLE_GROUPS.filter(
  (group) => group !== 'full_body' && group !== 'other',
);

/**
 * The muscles an exercise also works, as they're saved: each once, in the app's order, never its
 * own muscle group, Full Body or Other.
 */
export function cleanSecondaryGroups(
  groups: readonly MuscleGroup[],
  primary: MuscleGroup,
): MuscleGroup[] {
  return SECONDARY_MUSCLE_GROUPS.filter((group) => group !== primary && groups.includes(group));
}
