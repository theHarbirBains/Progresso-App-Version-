// A workout's cardio as the API hands it out (20261208100000_workout_cardio.sql), and its total
// active training time -- the same rule as the app's cardio/workoutTime.ts: strength runs from the
// workout's start to when its strength part ended (or its finish) less the cardio done before then,
// and the cardio's own times are added to it. Rests and breaks are in neither.

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

/** One cardio activity, its figures in canonical units (metres, km/h). */
export interface WorkoutCardio {
  id: string;
  activity: CardioActivity;
  name: string | null;
  durationSeconds: number;
  distanceM: number | null;
  calories: number | null;
  speedKmh: number | null;
  inclinePercent: number | null;
  resistanceLevel: number | null;
  floors: number | null;
  afterStrength: boolean;
}

export const CARDIO_COLUMNS =
  'id, workout_id, activity, name, duration_seconds, distance_m, calories, speed_kmh, incline_percent, resistance_level, floors, after_strength, created_at';

export interface CardioRow {
  id: string;
  workout_id: string;
  activity: CardioActivity;
  name: string | null;
  duration_seconds: number;
  distance_m: string | number | null;
  calories: number | null;
  speed_kmh: string | number | null;
  incline_percent: string | number | null;
  resistance_level: number | null;
  floors: number | null;
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
    calories: row.calories,
    speedKmh: numberOrNull(row.speed_kmh),
    inclinePercent: numberOrNull(row.incline_percent),
    resistanceLevel: row.resistance_level,
    floors: row.floors,
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
 * Strength and cardio together, in whole minutes; null when there's no cardio (the card shows its
 * duration then) or the strength part's time isn't known (logged with no duration).
 */
export function activeMinutes(workout: {
  performedAt: string;
  completedAt: string | null;
  strengthEndedAt: string | null;
  hasStrength: boolean;
  cardio: WorkoutCardio[];
}): number | null {
  if (workout.cardio.length === 0) return null;
  const cardioSeconds = workout.cardio.reduce((sum, c) => sum + c.durationSeconds, 0);
  if (!workout.hasStrength) return Math.round(cardioSeconds / 60);
  const end = workout.strengthEndedAt ?? workout.completedAt;
  const window = end === null ? 0 : secondsBetween(workout.performedAt, end);
  if (window === 0) return null;
  const before = workout.cardio
    .filter((c) => !c.afterStrength)
    .reduce((sum, c) => sum + c.durationSeconds, 0);
  return Math.round((Math.max(0, window - before) + cardioSeconds) / 60);
}
