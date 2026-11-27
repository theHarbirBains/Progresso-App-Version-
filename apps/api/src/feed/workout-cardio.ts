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
 * A gap between two sets longer than this wasn't lifting -- a long break, or cardio between
 * exercises -- so it's room the cardio may have been done in. The app's LIFTING_GAP_SECONDS.
 */
export const LIFTING_GAP_SECONDS = 10 * 60;

/** The time spent lifting: from each finished set to the next, leaving out any longer gap. */
export function liftingSeconds(setTimes: readonly string[]): number {
  const times = setTimes
    .map((at) => new Date(at).getTime())
    .filter((at) => Number.isFinite(at))
    .sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = (times[i]! - times[i - 1]!) / 1000;
    if (gap <= LIFTING_GAP_SECONDS) total += gap;
  }
  return Math.round(total);
}

/**
 * The workout's total time in whole minutes, for a workout with cardio -- the same rule as the app's
 * cardio/workoutTime.ts (Harbir's): the strength training and the cardio together. The workout's
 * own time, start to finish, holds as much of the cardio as there's room for beside the lifting
 * (its sets' times); cardio there isn't room for was done outside it and adds to it. For cardio
 * alone, the cardio's. Null with no cardio (the card shows its duration then), or for a workout
 * with strength training logged with no duration.
 */
export function totalMinutes(workout: {
  performedAt: string;
  completedAt: string | null;
  hasStrength: boolean;
  /** When each finished set was finished, warm-ups and drops too. */
  setTimes?: readonly string[];
  cardio: WorkoutCardio[];
}): number | null {
  if (workout.cardio.length === 0) return null;
  const cardioSeconds = workout.cardio.reduce((sum, c) => sum + c.durationSeconds, 0);
  if (!workout.hasStrength) return Math.round(cardioSeconds / 60);
  const span =
    workout.completedAt === null ? 0 : secondsBetween(workout.performedAt, workout.completedAt);
  if (span === 0) return null;
  const lifting = Math.min(span, liftingSeconds(workout.setTimes ?? []));
  // No lifting measured (sets logged after the fact share one time): cardio that fits in the time
  // typed was done within it; cardio as long as all of it or longer was done outside it.
  const within =
    lifting > 0
      ? Math.min(cardioSeconds, span - lifting)
      : cardioSeconds < span
        ? cardioSeconds
        : 0;
  return Math.round((span + cardioSeconds - within) / 60);
}
