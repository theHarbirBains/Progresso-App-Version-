import { supabase } from '../lib/supabase';
import type { SplitMuscleGroup } from './splitMuscleGroups';
import type { WorkoutSummary } from './workoutQueries';

export interface EnrichedWorkoutSummary extends WorkoutSummary {
  /** From the workout's tagged split day -- never inferred from its exercises. Null for a workout with no split day tagged. */
  splitDayName: string | null;
  muscleGroups: SplitMuscleGroup[];
  /** Only sets that were actually logged (weight + reps entered and marked complete) -- the same completed-set definition used everywhere else in the app, never a raw count of every set row. */
  completedSetCount: number;
  /** Null if somehow still incomplete (shouldn't happen for a completed-workout query, but avoids a NaN if it ever does). */
  durationMinutes: number | null;
}

function computeCompletedDurationMinutes(
  performedAt: string,
  completedAt: string | null,
): number | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(performedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

/**
 * Batch-joins a list of workout summaries (already fetched via
 * fetchWorkoutHistory/fetchWorkoutsForMonth) up to their split day's
 * name/muscle groups and down to their completed-set count -- three
 * queries total regardless of how many workouts are in the list, never one
 * request per workout, matching the existing fetchWorkoutDetail pattern of
 * batching a per-parent-row Supabase request into a single grouped fetch.
 */
export async function enrichWorkoutSummaries(
  workouts: WorkoutSummary[],
): Promise<EnrichedWorkoutSummary[]> {
  if (workouts.length === 0) return [];

  const splitDayIds = Array.from(
    new Set(workouts.map((w) => w.workoutSplitDayId).filter((id): id is string => id !== null)),
  );
  const splitDayInfo = new Map<string, { name: string; muscleGroups: SplitMuscleGroup[] }>();
  if (splitDayIds.length > 0) {
    const { data, error } = await supabase
      .from('workout_split_days')
      .select('id, name, workout_split_day_muscle_groups(muscle_group)')
      .in('id', splitDayIds);
    if (error) throw new Error(error.message);
    for (const day of data ?? []) {
      const embedded = day.workout_split_day_muscle_groups as unknown as
        { muscle_group: SplitMuscleGroup }[] | null;
      splitDayInfo.set(day.id, {
        name: day.name,
        muscleGroups: (embedded ?? []).map((m) => m.muscle_group),
      });
    }
  }

  const workoutIds = workouts.map((w) => w.id);
  const { data: workoutExercises, error: weError } = await supabase
    .from('workout_exercises')
    .select('id, workout_id')
    .in('workout_id', workoutIds)
    .is('deleted_at', null);
  if (weError) throw new Error(weError.message);

  const workoutIdByExerciseId = new Map<string, string>();
  for (const we of workoutExercises ?? []) {
    workoutIdByExerciseId.set(we.id, we.workout_id);
  }

  const completedSetCountByWorkoutId = new Map<string, number>();
  const workoutExerciseIds = Array.from(workoutIdByExerciseId.keys());
  if (workoutExerciseIds.length > 0) {
    const { data: sets, error: setsError } = await supabase
      .from('sets')
      .select('workout_exercise_id')
      .in('workout_exercise_id', workoutExerciseIds)
      .is('deleted_at', null)
      .not('completed_at', 'is', null)
      .not('weight_kg', 'is', null)
      .not('reps', 'is', null);
    if (setsError) throw new Error(setsError.message);

    for (const set of sets ?? []) {
      const workoutId = workoutIdByExerciseId.get(set.workout_exercise_id);
      if (!workoutId) continue;
      completedSetCountByWorkoutId.set(
        workoutId,
        (completedSetCountByWorkoutId.get(workoutId) ?? 0) + 1,
      );
    }
  }

  return workouts.map((workout) => {
    const day = workout.workoutSplitDayId ? splitDayInfo.get(workout.workoutSplitDayId) : undefined;
    return {
      ...workout,
      splitDayName: day?.name ?? null,
      muscleGroups: day?.muscleGroups ?? [],
      completedSetCount: completedSetCountByWorkoutId.get(workout.id) ?? 0,
      durationMinutes: computeCompletedDurationMinutes(workout.performedAt, workout.completedAt),
    };
  });
}
