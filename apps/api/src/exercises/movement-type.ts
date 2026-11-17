// Mirrors the public.movement_type / public.logging_style Postgres enums
// exactly (see 20260910100000_unilateral_exercises.sql).
export const MOVEMENT_TYPES = ['bilateral', 'unilateral'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const LOGGING_STYLES = ['single_side', 'alternating'] as const;
export type LoggingStyle = (typeof LOGGING_STYLES)[number];

// Mirrors public.measurement_type (20261019100000_bodyweight_and_timed_exercises.sql):
// what a set of the exercise records -- a weight and reps, reps only, or a duration.
export const MEASUREMENT_TYPES = ['weight_reps', 'bodyweight', 'timed'] as const;
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

// Mirrors exercises.load_type and exercises.pulley (20261123100000_machine_load_and_pulley.sql):
// how a machine is loaded, and whether its pulley makes the stack feel heavier or lighter.
export const LOAD_TYPES = ['single_stack', 'double_stack', 'plate_loaded'] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

// The old pulley -- 'heavier' or 'lighter', a feeling rather than a reference point. No longer
// offered, but kept on the exercises that have one (and accepted from older app versions).
export const PULLEYS = ['heavier', 'lighter'] as const;
export type Pulley = (typeof PULLEYS)[number];

// Mirrors exercises.equipment, grip, pulley_position (20261127100000_exercise_setup_details.sql):
// what an exercise is done with, and where a cable starts on its machine.
export const EQUIPMENT = [
  'dumbbell',
  'barbell',
  'kettlebell',
  'cable',
  'machine',
  'bodyweight',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const PULLEY_POSITIONS = ['high', 'mid', 'low', 'adjustable', 'other'] as const;
export type PulleyPosition = (typeof PULLEY_POSITIONS)[number];

// The grips and foot positions the form offered when grip and handle shared one field
// (`attachment`). One sent there by an older app version is kept as the grip, as the migration
// moved the ones already saved.
const LEGACY_GRIPS = new Set([
  'wide grip',
  'close grip',
  'neutral grip',
  'overhand',
  'underhand',
  'mixed grip',
  'feet high',
  'feet low',
  'feet wide',
  'feet close',
  'toes out',
  'toes in',
]);

/** Whether an older app's Grip or Handle text is one of its grips -- so it's saved as the grip. */
export function isLegacyGrip(text: string | null | undefined): boolean {
  return typeof text === 'string' && LEGACY_GRIPS.has(text.trim().toLowerCase());
}
