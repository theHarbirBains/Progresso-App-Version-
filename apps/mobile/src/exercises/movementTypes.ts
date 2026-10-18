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

// Mirrors public.measurement_type (20261019100000_bodyweight_and_timed_exercises.sql): what
// a set of the exercise records. A weighted variant (Weighted Pull-Up) is its own
// weight_reps exercise whose weight is the load added; a bodyweight exercise records reps
// only; a timed one a duration only.
export const MEASUREMENT_TYPES = ['weight_reps', 'bodyweight', 'timed'] as const;
export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];

// Short enough for three segments across a phone; `spoken` is what assistive tech reads and
// `hint` the line under the choice.
export const MEASUREMENT_TYPE_LABELS: Record<
  MeasurementType,
  { label: string; spoken: string; hint: string }
> = {
  weight_reps: {
    label: 'Weight',
    spoken: 'Weight and reps',
    hint: 'A weight and reps for each set.',
  },
  bodyweight: {
    label: 'Reps',
    spoken: 'Reps only',
    hint: 'Reps only, at bodyweight. For added weight, make a weighted version.',
  },
  timed: { label: 'Time', spoken: 'Time', hint: 'A time for each set, like a plank.' },
};

/**
 * What something was measured by, with the default for anything that doesn't say: weight
 * and reps, which is what every exercise was before measurement types existed.
 */
export function measurementTypeOf(item: {
  measurementType?: MeasurementType | null;
}): MeasurementType {
  return item.measurementType ?? 'weight_reps';
}
