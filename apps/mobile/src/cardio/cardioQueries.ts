import { fetchAllRows } from '../lib/fetchAllRows';
import { supabase } from '../lib/supabase';
import { CARDIO_ACTIVITIES, type CardioActivity, type CardioValues } from './cardioActivities';

// A workout's cardio, straight to Supabase under own-row RLS like its sets
// (20261208100000_workout_cardio.sql, 20261211100000_cardio_metrics.sql): the row's owner is
// always the workout's, set by trigger. Calories are never read or written -- what older
// activities hold stays in the row untouched.

/** A cardio activity in a workout, as saved. */
export interface CardioEntry extends CardioValues {
  id: string;
  workoutId: string;
  /** Done after the strength part ended (added after the last set): not taken out of its time. */
  afterStrength: boolean;
  createdAt: string;
}

const CARDIO_COLUMNS =
  'id, workout_id, activity, name, duration_seconds, distance_m, speed_kmh, speed_setting, incline_percent, resistance_level, floors, steps, stroke_rate, pool_length_m, laps, notes, after_strength, created_at';

interface CardioRow {
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
    speed_kmh: values.speedKmh,
    speed_setting: values.speedSetting,
    incline_percent: values.inclinePercent,
    resistance_level: values.resistanceLevel,
    floors: values.floors,
    steps: values.steps,
    stroke_rate: values.strokeRate,
    pool_length_m: values.poolLengthM,
    laps: values.laps,
    notes: values.notes,
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

/**
 * Where a live workout's strength part ended, worked out at Finish with nothing asked: at its last
 * finished set. Cardio added after that set was done after the lifting; anything added before it
 * was done during it, and comes out of the strength time (cardio/workoutTime.ts). Only the
 * activities whose side of that moment changed are written.
 */
export async function settleStrengthTime(
  workoutId: string,
  lastSetAt: string,
  cardio: { id: string; createdAt: string; afterStrength: boolean }[],
): Promise<void> {
  const end = Date.parse(lastSetAt);
  const { error } = await supabase
    .from('workouts')
    .update({ strength_ended_at: lastSetAt })
    .eq('id', workoutId)
    .is('deleted_at', null);
  if (error) throw new Error(error.message);
  for (const after of [true, false]) {
    const ids = cardio
      .filter(
        (entry) => Date.parse(entry.createdAt) > end === after && entry.afterStrength !== after,
      )
      .map((entry) => entry.id);
    if (ids.length === 0) continue;
    const { error: cardioError } = await supabase
      .from('workout_cardio')
      .update({ after_strength: after })
      .in('id', ids);
    if (cardioError) throw new Error(cardioError.message);
  }
}

/**
 * The activities the person did last, most recent first, one each -- what Add Cardio offers
 * first. Their own only (a trainer can read a client's). Never fails a page: none on an error.
 */
export async function fetchRecentCardioActivities(userId: string): Promise<CardioActivity[]> {
  const { data, error } = await supabase
    .from('workout_cardio')
    .select('activity')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) return [];
  const seen: CardioActivity[] = [];
  for (const row of (data ?? []) as { activity: CardioActivity }[]) {
    if (CARDIO_ACTIVITIES.includes(row.activity) && !seen.includes(row.activity)) {
      seen.push(row.activity);
    }
  }
  return seen;
}

/** A cardio activity in the person's history: when its workout was, as well as its figures. */
export interface CardioHistoryEntry extends CardioEntry {
  /** When the workout it's in started. */
  performedAt: string;
}

/**
 * Every cardio activity in the person's finished workouts (not deleted ones, nor one still going),
 * oldest first -- what Progress's Cardio tab works its figures out from. Their own only, a page
 * at a time past Supabase's row cap.
 */
export async function fetchCardioHistory(userId: string): Promise<CardioHistoryEntry[]> {
  type Row = CardioRow & {
    workouts: {
      performed_at: string;
      completed_at: string | null;
      deleted_at: string | null;
    } | null;
  };
  const rows = await fetchAllRows<Row>((from, to) =>
    supabase
      .from('workout_cardio')
      .select(`${CARDIO_COLUMNS}, workouts(performed_at, completed_at, deleted_at)`, {
        count: 'exact',
      })
      .eq('user_id', userId)
      .order('id')
      .range(from, to),
  );
  return rows
    .filter((row) => row.workouts && row.workouts.completed_at && !row.workouts.deleted_at)
    .map((row) => ({ ...toCardioEntry(row), performedAt: row.workouts!.performed_at }))
    .sort((a, b) => a.performedAt.localeCompare(b.performedAt) || a.id.localeCompare(b.id));
}
