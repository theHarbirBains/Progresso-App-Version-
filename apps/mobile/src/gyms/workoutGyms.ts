import { supabase } from '../lib/supabase';
import { sameGym, type GymPlace } from './gymSearch';

// The gym a workout was done at (workout_gyms, 20261221100000): kept against the one workout as
// it was chosen, read and written straight from Supabase under its own-row policies -- only ever
// the workout's owner. Changing it on one workout never touches another.

/** A workout's gym, as it was saved. */
export interface WorkoutGym extends GymPlace {
  workoutId: string;
}

interface GymRow {
  workout_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
}

const COLUMNS = 'workout_id, name, address, latitude, longitude, place_id';

function toWorkoutGym(row: GymRow): WorkoutGym {
  return {
    workoutId: row.workout_id,
    name: row.name,
    address: row.address ?? '',
    latitude: row.latitude,
    longitude: row.longitude,
    ...(row.place_id ? { placeId: row.place_id } : {}),
  };
}

/** A workout's gym, or null for none. */
export async function fetchWorkoutGym(workoutId: string): Promise<WorkoutGym | null> {
  const { data, error } = await supabase
    .from('workout_gyms')
    .select(COLUMNS)
    .eq('workout_id', workoutId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toWorkoutGym(data as GymRow) : null;
}

/** Several workouts' gyms at once (a history list), by workout. */
export async function fetchGymsForWorkouts(
  workoutIds: readonly string[],
): Promise<Map<string, WorkoutGym>> {
  if (workoutIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('workout_gyms')
    .select(COLUMNS)
    .in('workout_id', [...workoutIds]);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as GymRow[]).map((row) => [row.workout_id, toWorkoutGym(row)]));
}

/** Saves the gym a workout was done at -- replacing the one it had, if any. */
export async function setWorkoutGym(
  userId: string,
  workoutId: string,
  gym: GymPlace,
): Promise<WorkoutGym> {
  const row = {
    workout_id: workoutId,
    user_id: userId,
    name: gym.name.trim().slice(0, 120),
    address: gym.address.trim() ? gym.address.trim().slice(0, 240) : null,
    latitude: gym.latitude,
    longitude: gym.longitude,
    place_id: gym.placeId ?? null,
  };
  const { data, error } = await supabase
    .from('workout_gyms')
    .upsert(row, { onConflict: 'workout_id' })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toWorkoutGym(data as GymRow);
}

/** Takes a workout's gym off it. */
export async function removeWorkoutGym(workoutId: string): Promise<void> {
  const { error } = await supabase.from('workout_gyms').delete().eq('workout_id', workoutId);
  if (error) throw new Error(error.message);
}

/** The gyms they've trained at lately, the latest first, each once -- one tap to use again. */
export async function fetchRecentGyms(userId: string, limit = 5): Promise<GymPlace[]> {
  const { data, error } = await supabase
    .from('workout_gyms')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  const recent: GymPlace[] = [];
  for (const row of (data ?? []) as GymRow[]) {
    const { workoutId: _workoutId, ...gym } = toWorkoutGym(row);
    void _workoutId;
    if (!recent.some((kept) => sameGym(kept, gym))) recent.push(gym);
    if (recent.length >= limit) break;
  }
  return recent;
}
