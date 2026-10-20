import type { MuscleGroup } from '../exercises/muscleGroups';
import { fetchAllRows, fetchAllRowsForIds } from '../lib/fetchAllRows';
import { supabase } from '../lib/supabase';
import type { SummarySet, SummaryWorkout } from './weeklySummary';

/**
 * The user's completed workouts from `since` up to (not including) `until`, and every
 * completed set in them, of every measurement type -- what a weekly summary is worked out
 * from. Bounded to a few weeks, unlike the all-time loads, and paged and chunked like them
 * (lib/fetchAllRows.ts), so a busy month is read in full.
 */
export async function fetchSummaryTraining(
  userId: string,
  since: Date,
  until: Date,
): Promise<{ workouts: SummaryWorkout[]; sets: SummarySet[] }> {
  const workoutRows = await fetchAllRows<{ id: string; performed_at: string }>((from, to) =>
    supabase
      .from('workouts')
      .select('id, performed_at', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .not('completed_at', 'is', null)
      .gte('performed_at', since.toISOString())
      .lt('performed_at', until.toISOString())
      .order('id')
      .range(from, to),
  );
  const workouts = workoutRows.map((row) => ({ id: row.id, performedAt: row.performed_at }));
  if (workouts.length === 0) return { workouts, sets: [] };
  const performedAt = new Map(workouts.map((workout) => [workout.id, workout.performedAt]));

  type ExerciseRow = {
    id: string;
    workout_id: string;
    exercise_id: string;
    measurement_type: SummarySet['measurementType'] | null;
    exercises: { name: string; muscle_group: MuscleGroup } | null;
  };
  const exerciseRows = await fetchAllRowsForIds<ExerciseRow>(
    workouts.map((workout) => workout.id),
    (ids, from, to) =>
      supabase
        .from('workout_exercises')
        .select('id, workout_id, exercise_id, measurement_type, exercises(name, muscle_group)', {
          count: 'exact',
        })
        .in('workout_id', ids)
        .is('deleted_at', null)
        .order('id')
        .range(from, to),
  );
  if (exerciseRows.length === 0) return { workouts, sets: [] };
  const exercises = new Map(exerciseRows.map((row) => [row.id, row]));

  const setRows = await fetchAllRowsForIds<{
    workout_exercise_id: string;
    weight_kg: string | number | null;
    reps: number | null;
  }>(
    exerciseRows.map((row) => row.id),
    (ids, from, to) =>
      supabase
        .from('sets')
        .select('workout_exercise_id, weight_kg, reps', { count: 'exact' })
        .in('workout_exercise_id', ids)
        .is('deleted_at', null)
        .not('completed_at', 'is', null)
        .order('id')
        .range(from, to),
  );

  const sets = setRows.flatMap((row): SummarySet[] => {
    const exercise = exercises.get(row.workout_exercise_id);
    if (!exercise) return [];
    return [
      {
        workoutId: exercise.workout_id,
        performedAt: performedAt.get(exercise.workout_id)!,
        exerciseId: exercise.exercise_id,
        exerciseName: exercise.exercises?.name ?? 'Exercise',
        muscleGroup: exercise.exercises?.muscle_group ?? 'other',
        measurementType: exercise.measurement_type ?? 'weight_reps',
        weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
        reps: row.reps,
      },
    ];
  });
  return { workouts, sets };
}
