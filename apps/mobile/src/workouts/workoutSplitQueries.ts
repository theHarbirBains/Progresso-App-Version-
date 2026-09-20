import { supabase } from '../lib/supabase';
import type { SplitMuscleGroup } from './splitMuscleGroups';
import type { WorkoutSplitPreset } from './workoutSplitPresets';

// Direct-to-Supabase CRUD, same architecture as workoutQueries.ts: ownership
// is enforced by RLS + the owner-derivation triggers in
// 20260906100002_workout_splits.sql, so there's no business logic here for a
// backend layer to centralize. A split only ever holds day names + muscle
// groups -- never exercises; the user picks actual exercises when they
// perform the workout (see NewWorkoutScreen).

export interface WorkoutSplitSummary {
  id: string;
  name: string;
}

export interface WorkoutSplitDay {
  id: string;
  name: string;
  orderIndex: number;
  muscleGroups: SplitMuscleGroup[];
}

export interface WorkoutSplitDetail extends WorkoutSplitSummary {
  days: WorkoutSplitDay[];
}

/** Every workout split this user has created, in creation order. */
export async function fetchWorkoutSplits(userId: string): Promise<WorkoutSplitSummary[]> {
  const { data, error } = await supabase
    .from('workout_splits')
    .select('id, name')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** One split with its ordered days and each day's muscle groups. */
export async function fetchWorkoutSplitDetail(splitId: string): Promise<WorkoutSplitDetail> {
  const { data: split, error: splitError } = await supabase
    .from('workout_splits')
    .select('id, name')
    .eq('id', splitId)
    .single();
  if (splitError) throw new Error(splitError.message);

  const { data: days, error: daysError } = await supabase
    .from('workout_split_days')
    .select('id, name, order_index, workout_split_day_muscle_groups(muscle_group)')
    .eq('workout_split_id', splitId)
    .order('order_index', { ascending: true });
  if (daysError) throw new Error(daysError.message);

  type DayRow = {
    id: string;
    name: string;
    order_index: number;
    workout_split_day_muscle_groups: { muscle_group: SplitMuscleGroup }[];
  };

  return {
    id: split.id,
    name: split.name,
    days: ((days ?? []) as unknown as DayRow[]).map((d) => ({
      id: d.id,
      name: d.name,
      orderIndex: d.order_index,
      muscleGroups: d.workout_split_day_muscle_groups.map((m) => m.muscle_group),
    })),
  };
}

export async function createWorkoutSplit(
  userId: string,
  name: string,
): Promise<WorkoutSplitSummary> {
  const { data, error } = await supabase
    .from('workout_splits')
    .insert({ user_id: userId, name })
    .select('id, name')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function renameWorkoutSplit(splitId: string, name: string): Promise<void> {
  const { error } = await supabase.from('workout_splits').update({ name }).eq('id', splitId);
  if (error) throw new Error(error.message);
}

/** Cascades to the split's days and their muscle groups (see the migration); clears active_workout_split_id/workout_split_day_id references rather than blocking. */
export async function deleteWorkoutSplit(splitId: string): Promise<void> {
  const { error } = await supabase.from('workout_splits').delete().eq('id', splitId);
  if (error) throw new Error(error.message);
}

/** Deep-copies a split's days and muscle groups under a new split, e.g. "PPL Copy". */
export async function duplicateWorkoutSplit(
  userId: string,
  splitId: string,
): Promise<WorkoutSplitSummary> {
  const detail = await fetchWorkoutSplitDetail(splitId);
  const newSplit = await createWorkoutSplit(userId, `${detail.name} Copy`);
  for (const day of detail.days) {
    const newDay = await createWorkoutSplitDay(newSplit.id, day.name, day.orderIndex);
    if (day.muscleGroups.length > 0) {
      await setWorkoutSplitDayMuscleGroups(newDay.id, day.muscleGroups);
    }
  }
  return newSplit;
}

/**
 * Presets (workoutSplitPresets.ts) are reusable templates, never stored as
 * a user's own data until they're picked -- this materializes one into a
 * real, editable, user-owned split (same shape duplicateWorkoutSplit
 * produces), which the caller is then free to customize like any other
 * split.
 */
export async function materializeWorkoutSplitPreset(
  userId: string,
  preset: WorkoutSplitPreset,
): Promise<WorkoutSplitSummary> {
  const newSplit = await createWorkoutSplit(userId, preset.name);
  for (let i = 0; i < preset.days.length; i++) {
    const day = preset.days[i];
    const newDay = await createWorkoutSplitDay(newSplit.id, day.name, i + 1);
    if (day.muscleGroups.length > 0) {
      await setWorkoutSplitDayMuscleGroups(newDay.id, day.muscleGroups);
    }
  }
  return newSplit;
}

export async function createWorkoutSplitDay(
  splitId: string,
  name: string,
  orderIndex: number,
): Promise<WorkoutSplitDay> {
  const { data, error } = await supabase
    .from('workout_split_days')
    .insert({ workout_split_id: splitId, name, order_index: orderIndex })
    .select('id, name, order_index')
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.name, orderIndex: data.order_index, muscleGroups: [] };
}

export async function renameWorkoutSplitDay(dayId: string, name: string): Promise<void> {
  const { error } = await supabase.from('workout_split_days').update({ name }).eq('id', dayId);
  if (error) throw new Error(error.message);
}

/** Cascades to the day's muscle groups; clears workout_split_day_id on any workout tagged with this day. */
export async function deleteWorkoutSplitDay(dayId: string): Promise<void> {
  const { error } = await supabase.from('workout_split_days').delete().eq('id', dayId);
  if (error) throw new Error(error.message);
}

/** Bulk single-statement reorder, mirroring workoutQueries.reorderExercises' upsert pattern against the same deferred-unique-constraint shape. */
export async function reorderWorkoutSplitDays(
  splitId: string,
  orderedDays: { id: string; name: string }[],
): Promise<void> {
  const { error } = await supabase.from('workout_split_days').upsert(
    orderedDays.map((day, index) => ({
      id: day.id,
      workout_split_id: splitId,
      name: day.name,
      order_index: index + 1,
    })),
  );
  if (error) throw new Error(error.message);
}

/** Replaces a day's full muscle-group set (simplest correct approach for what is always a small list). */
export async function setWorkoutSplitDayMuscleGroups(
  dayId: string,
  muscleGroups: SplitMuscleGroup[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from('workout_split_day_muscle_groups')
    .delete()
    .eq('workout_split_day_id', dayId);
  if (deleteError) throw new Error(deleteError.message);

  if (muscleGroups.length === 0) return;

  const { error: insertError } = await supabase.from('workout_split_day_muscle_groups').insert(
    muscleGroups.map((muscleGroup) => ({
      workout_split_day_id: dayId,
      muscle_group: muscleGroup,
    })),
  );
  if (insertError) throw new Error(insertError.message);
}

/**
 * The split day the user's most recently completed, split-tagged workout was
 * tagged with, or null if none. Deliberately skips untagged workouts (e.g. a
 * "Do a Different Workout" improvised session) rather than taking the single
 * most recent completed workout regardless of tag -- an improvised workout
 * has no bearing on split progression, so it must not reset next-workout
 * recommendation back to day 1.
 */
export async function fetchLastWorkoutSplitDayId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select('workout_split_day_id')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .not('workout_split_day_id', 'is', null)
    .is('deleted_at', null)
    .order('performed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.workout_split_day_id ?? null;
}
