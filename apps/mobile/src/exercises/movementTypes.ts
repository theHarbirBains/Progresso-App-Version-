// Mirrors the public.movement_type / public.logging_style Postgres enums
// exactly (see supabase/migrations/20260910100000_unilateral_exercises.sql).
// A unilateral movement (Bulgarian Split Squat, Single-Arm Row, ...) is
// still one exercise record -- logging_style only describes how its sets
// are performed, never a second exercise identity.
export const MOVEMENT_TYPES = ['bilateral', 'unilateral'] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const MOVEMENT_TYPE_LABELS: Record<MovementType, string> = {
  bilateral: 'Bilateral',
  unilateral: 'Unilateral',
};

export const LOGGING_STYLES = ['single_side', 'alternating'] as const;
export type LoggingStyle = (typeof LOGGING_STYLES)[number];
