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

export const PULLEYS = ['heavier', 'lighter'] as const;
export type Pulley = (typeof PULLEYS)[number];
