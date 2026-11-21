import { supabase } from '../lib/supabase';
import type { CardioActivity, CardioValues } from './cardioActivities';

// A workout's cardio, straight to Supabase under own-row RLS like its sets
// (20261208100000_workout_cardio.sql): the row's owner is always the workout's, set by trigger.

/** A cardio activity in a workout, as saved. */
export interface CardioEntry extends CardioValues {
  id: string;
  workoutId: string;
  /** Added once the strength part had ended (Finish's Add Cardio): not taken out of its time. */
  afterStrength: boolean;
  createdAt: string;
}

const CARDIO_COLUMNS =
  'id, workout_id, activity, name, duration_seconds, distance_m, calories, speed_kmh, incline_percent, resistance_level, floors, after_strength, created_at';

interface CardioRow {
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
  after_strength: boolean;
  created_at: string;
}

const numberOrNull = (value: string | number | null) => (value === null ? null : Number(value));

function toCardioEntry(row: CardioRow): CardioEntry {
  return {
    id: row.id,
    workoutId: row.workout_id,
    activity: row.activity,
    name: row.name,
    durationSeconds: row.duration_seconds,
    distanceM: numberOrNull(row.distance_m),
    calories: row.calories,
    speedKmh: numberOrNull(row.speed_kmh),
    inclinePercent: numberOrNull(row.incline_percent),
    resistanceLevel: row.resistance_level,
    floors: row.floors,
    afterStrength: row.after_strength,
    createdAt: row.created_at,
  };
}

function toRow(values: CardioValues) {
  return {
    activity: values.activity,
    name: values.name,
    duration_seconds: values.durationSeconds,
    distance_m: values.distanceM,
    calories: values.calories,
    speed_kmh: values.speedKmh,
    incline_percent: values.inclinePercent,
    resistance_level: values.resistanceLevel,
    floors: values.floors,
  };
}

/** Each workout's cardio, in the order it was added, by workout id. */
export async function fetchCardioFor(workoutIds: string[]): Promise<Map<string, CardioEntry[]>> {
  const byWorkout = new Map<string, CardioEntry[]>();
  if (workoutIds.length === 0) return byWorkout;
  const { data, error } = await supabase
    .from('workout_cardio')
    .select(CARDIO_COLUMNS)
    .in('workout_id', workoutIds)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as CardioRow[]) {
    const entry = toCardioEntry(row);
    byWorkout.set(entry.workoutId, [...(byWorkout.get(entry.workoutId) ?? []), entry]);
  }
  return byWorkout;
}

/** Adds a cardio activity to a workout. */
export async function addCardio(
  workoutId: string,
  values: CardioValues,
  options: { afterStrength?: boolean } = {},
): Promise<CardioEntry> {
  const { data, error } = await supabase
    .from('workout_cardio')
    .insert({
      workout_id: workoutId,
      ...toRow(values),
      after_strength: options.afterStrength === true,
    })
    .select(CARDIO_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toCardioEntry(data as CardioRow);
}

/** Changes a cardio activity's figures (its workout and when it was done stay). */
export async function updateCardio(id: string, values: CardioValues): Promise<CardioEntry> {
  const { data, error } = await supabase
    .from('workout_cardio')
    .update(toRow(values))
    .eq('id', id)
    .select(CARDIO_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toCardioEntry(data as CardioRow);
}

export async function deleteCardio(id: string): Promise<void> {
  const { error } = await supabase.from('workout_cardio').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Every activity of a workout so far was done during its strength part (it resumed after them). */
export async function markCardioDuringStrength(workoutId: string): Promise<void> {
  const { error } = await supabase
    .from('workout_cardio')
    .update({ after_strength: false })
    .eq('workout_id', workoutId);
  if (error) throw new Error(error.message);
}

/**
 * Ends the strength part of a workout at `at` (Finish's Add Cardio), or opens it again (null):
 * strength training time runs from the start to here.
 */
export async function setStrengthEnded(workoutId: string, at: string | null): Promise<void> {
  const { error } = await supabase
    .from('workouts')
    .update({ strength_ended_at: at })
    .eq('id', workoutId)
    .is('deleted_at', null);
  if (error) throw new Error(error.message);
}
