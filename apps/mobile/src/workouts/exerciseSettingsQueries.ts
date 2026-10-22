import type { MeasurementType } from '../exercises/movementTypes';
import { supabase } from '../lib/supabase';
import type { RepRange } from './progression';

// Per-exercise progression settings (exercise_progression_settings): a rep range for this one
// exercise, and the weight to add when it's time to go heavier -- the equipment's own step.
// Either can be left out. Direct-to-Supabase, own rows only. Suggestions only: nothing here
// changes a set, a record or a weight.
//
// Which range applies: this exercise's own, when set; otherwise the person's (Settings >
// Workout Preferences). These are the person's "exceptions" to their range; their trainer can
// set them too, through the API (trainerApi.ts), and they're the same rows either way.

export interface ExerciseProgressionSetting {
  exerciseId: string;
  /** The exercise's name, for listing settings in Settings. */
  exerciseName: string;
  /** What the exercise measures: only a weighted one has a weight step. */
  measurementType: MeasurementType;
  range: RepRange | null;
  incrementKg: number | null;
}

interface SettingDbRow {
  exercise_id: string;
  rep_range_min: number | null;
  rep_range_max: number | null;
  weight_increment_kg: string | number | null;
  exercises:
    | { name: string; measurement_type: MeasurementType | null }
    | { name: string; measurement_type: MeasurementType | null }[]
    | null;
}

function toSetting(row: SettingDbRow): ExerciseProgressionSetting {
  const exercise = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
  return {
    exerciseId: row.exercise_id,
    exerciseName: exercise?.name ?? 'Exercise',
    measurementType: exercise?.measurement_type ?? 'weight_reps',
    range:
      row.rep_range_min !== null && row.rep_range_max !== null
        ? { min: row.rep_range_min, max: row.rep_range_max }
        : null,
    incrementKg: row.weight_increment_kg === null ? null : Number(row.weight_increment_kg),
  };
}

const COLUMNS =
  'exercise_id, rep_range_min, rep_range_max, weight_increment_kg, exercises(name, measurement_type)';

/** Every exercise the person has their own settings for, by exercise id. */
export async function fetchExerciseSettings(
  userId: string,
): Promise<Map<string, ExerciseProgressionSetting>> {
  const { data, error } = await supabase
    .from('exercise_progression_settings')
    .select(COLUMNS)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return new Map(
    ((data ?? []) as unknown as SettingDbRow[]).map((row) => [row.exercise_id, toSetting(row)]),
  );
}

/**
 * Saves an exercise's own range and increment. With neither, the exercise goes back to the
 * person's own range and the default step, so the row is removed.
 */
export async function saveExerciseSetting(
  userId: string,
  exerciseId: string,
  setting: { range: RepRange | null; incrementKg: number | null },
): Promise<ExerciseProgressionSetting | null> {
  if (setting.range === null && setting.incrementKg === null) {
    await clearExerciseSetting(userId, exerciseId);
    return null;
  }
  const { data, error } = await supabase
    .from('exercise_progression_settings')
    .upsert(
      {
        user_id: userId,
        exercise_id: exerciseId,
        rep_range_min: setting.range?.min ?? null,
        rep_range_max: setting.range?.max ?? null,
        weight_increment_kg: setting.incrementKg,
      },
      { onConflict: 'user_id,exercise_id' },
    )
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toSetting(data as unknown as SettingDbRow);
}

/** Takes an exercise back to the person's own range and the default step. */
export async function clearExerciseSetting(userId: string, exerciseId: string): Promise<void> {
  const { error } = await supabase
    .from('exercise_progression_settings')
    .delete()
    .eq('user_id', userId)
    .eq('exercise_id', exerciseId);
  if (error) throw new Error(error.message);
}
