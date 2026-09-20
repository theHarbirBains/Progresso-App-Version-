// Mirrors the public.movement_type / public.logging_style Postgres enums
// exactly (see 20260910100000_unilateral_exercises.sql).
export const MOVEMENT_TYPES = ['bilateral', 'unilateral'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const LOGGING_STYLES = ['single_side', 'alternating'] as const;
export type LoggingStyle = (typeof LOGGING_STYLES)[number];
