// A workout's cardio as the API hands it out (20261208100000_workout_cardio.sql), and its total
// time -- the same rule as the app's cardio/workoutTime.ts: the cardio and the strength training
// together, start to finish.

export type CardioActivity =
  | 'treadmill'
  | 'outdoor_run'
  | 'walking'
  | 'cycling'
  | 'stairmaster'
  | 'elliptical'
  | 'rowing'
  | 'swimming'
  | 'other';

/**
 * One cardio activity, its figures in canonical units (metres, km/h) -- never calories
 * (20261211100000_cardio_metrics.sql): cardio carries none now.
 */
export interface WorkoutCardio {
  id: string;
  activity: CardioActivity;
  name: string | null;
  durationSeconds: number;
  distanceM: number | null;
  /**
   * Always null: calories are no longer shown. Kept for app versions from before, which read it
   * (one missing would show as "undefined cal").
   */
  calories: null;
  speedKmh: number | null;
  /** A treadmill's or elliptical's speed, as the machine shows it: no unit. */
  speedSetting: number | null;
  inclinePercent: number | null;
  resistanceLevel: number | null;
  floors: number | null;
  steps: number | null;
  strokeRate: number | null;
  poolLengthM: number | null;
  laps: number | null;
  notes: string | null;
  afterStrength: boolean;
}

export const CARDIO_COLUMNS =
  'id, workout_id, activity, name, duration_seconds, distance_m, speed_kmh, speed_setting, incline_percent, resistance_level, floors, steps, stroke_rate, pool_length_m, laps, notes, after_strength, created_at';

export interface CardioRow {
  id: string;
  workout_id: string;
  activity: CardioActivity;
  name: string | null;
  duration_seconds: number;
  distance_m: string | number | null;
  speed_kmh: string | number | null;
  speed_setting: string | number | null;
  incline_percent: string | number | null;
  resistance_level: number | null;
  floors: number | null;
  steps: number | null;
  stroke_rate: number | null;
  pool_length_m: string | number | null;
  laps: number | null;
  notes: string | null;
  after_strength: boolean | null;
}

const numberOrNull = (value: string | number | null) => (value === null ? null : Number(value));

export function toWorkoutCardio(row: CardioRow): WorkoutCardio {
  return {
    id: row.id,
    activity: row.activity,
    name: row.name,
    durationSeconds: row.duration_seconds,
    distanceM: numberOrNull(row.distance_m),
    calories: null,
    speedKmh: numberOrNull(row.speed_kmh),
    speedSetting: numberOrNull(row.speed_setting),
    inclinePercent: numberOrNull(row.incline_percent),
    resistanceLevel: row.resistance_level,
    floors: row.floors,
    steps: row.steps,
    strokeRate: row.stroke_rate,
    poolLengthM: numberOrNull(row.pool_length_m),
    laps: row.laps,
    notes: row.notes,
    afterStrength: row.after_strength === true,
  };
}

/** Each workout's cardio, in the order added, by workout id. */
export function cardioByWorkout(rows: CardioRow[]): Map<string, WorkoutCardio[]> {
  const byWorkout = new Map<string, WorkoutCardio[]>();
  for (const row of rows) {
    byWorkout.set(row.workout_id, [...(byWorkout.get(row.workout_id) ?? []), toWorkoutCardio(row)]);
  }
  return byWorkout;
}

const secondsBetween = (from: string, to: string) =>
  Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));

/**
 * The workout's total time in whole minutes, for a workout with cardio -- the same rule as the app's
 * cardio/workoutTime.ts (Harbir's): start to finish, the cardio and the strength training together,
 * or the cardio's own time where that comes to more (logged afterwards); for cardio alone, the
 * cardio's. Null with no cardio (the card shows its duration then), or for a workout with strength
 * training logged with no duration.
 */
export function totalMinutes(workout: {
  performedAt: string;
  completedAt: string | null;
  hasStrength: boolean;
  cardio: WorkoutCardio[];
}): number | null {
  if (workout.cardio.length === 0) return null;
  const cardioSeconds = workout.cardio.reduce((sum, c) => sum + c.durationSeconds, 0);
  if (!workout.hasStrength) return Math.round(cardioSeconds / 60);
  const span =
    workout.completedAt === null ? 0 : secondsBetween(workout.performedAt, workout.completedAt);
  if (span === 0) return null;
  return Math.round(Math.max(span, cardioSeconds) / 60);
}
