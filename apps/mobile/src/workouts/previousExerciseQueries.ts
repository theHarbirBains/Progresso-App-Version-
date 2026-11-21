import type { MeasurementType } from '../exercises/movementTypes';
import type { MuscleGroup } from '../exercises/muscleGroups';
import { supabase } from '../lib/supabase';
import type { PreviousExerciseRow } from './previousExercises';
import {
  EXERCISE_MUSCLE_GROUP_OF,
  SPLIT_MUSCLE_GROUPS,
  type SplitMuscleGroup,
} from './splitMuscleGroups';

/** The latest finished workouts per muscle group the database hands back (a day's few at most). */
const SESSIONS_PER_GROUP = 3;

interface SetJson {
  id: string;
  set_index: number;
  side: 'left' | 'right' | 'none' | null;
  weight_kg: number | string | null;
  reps: number | null;
  duration_seconds: number | null;
  completed_at: string;
}

interface Row {
  muscle_group: MuscleGroup;
  workout_id: string;
  performed_at: string;
  logged_by: string | null;
  workout_exercise_id: string;
  exercise_id: string;
  order_index: number;
  measurement_type: MeasurementType;
  sets: SetJson[] | null;
}

/**
 * What a person did the last few times they trained each muscle group -- their finished
 * workouts, whoever logged them, each exercise with its working sets. One request, worked out
 * by the database (previous_exercises_by_muscle_group), never their whole history.
 */
export async function fetchPreviousExercises(userId: string): Promise<PreviousExerciseRow[]> {
  const { data, error } = await supabase.rpc('previous_exercises_by_muscle_group', {
    p_user_id: userId,
    p_sessions: SESSIONS_PER_GROUP,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[]).map((row) => ({
    muscleGroup: row.muscle_group,
    workoutId: row.workout_id,
    performedAt: row.performed_at,
    loggedBy: row.logged_by,
    workoutExerciseId: row.workout_exercise_id,
    exerciseId: row.exercise_id,
    orderIndex: row.order_index,
    measurementType: row.measurement_type,
    sets: (row.sets ?? []).map((set) => ({
      id: set.id,
      setIndex: set.set_index,
      side: set.side === 'left' || set.side === 'right' ? set.side : null,
      weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
      reps: set.reps,
      durationSeconds: set.duration_seconds,
      completedAt: set.completed_at,
    })),
  }));
}

/** A split day's muscle groups in the library's vocabulary, in the usual order. */
export async function fetchSplitDayMuscleGroups(splitDayId: string): Promise<MuscleGroup[]> {
  const { data, error } = await supabase
    .from('workout_split_day_muscle_groups')
    .select('muscle_group')
    .eq('workout_split_day_id', splitDayId);
  if (error) throw new Error(error.message);
  const groups = ((data ?? []) as { muscle_group: SplitMuscleGroup }[]).map((r) => r.muscle_group);
  return SPLIT_MUSCLE_GROUPS.filter((group) => groups.includes(group)).map(
    (group) => EXERCISE_MUSCLE_GROUP_OF[group],
  );
}
