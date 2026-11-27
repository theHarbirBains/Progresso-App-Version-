import { fetchAllRows, fetchAllRowsForIds } from '../lib/fetchAllRows';
import { supabase } from '../lib/supabase';
import type { MeasurementType } from '../exercises/movementTypes';
import type { MuscleGroup } from '../exercises/muscleGroups';
import { fetchCompletedSetValues } from '../workouts/exerciseHistoryQueries';

/** One exercise done in one finished workout, with its working sets. */
export interface ActivityEntry {
  workoutId: string;
  performedAt: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  measurementType: MeasurementType;
  /**
   * The muscles the exercise also works (exercises.secondary_muscle_groups) -- a built-in's from
   * the catalogue, a custom one's as its owner chose. Absent where it wasn't read.
   */
  secondaryMuscleGroups?: MuscleGroup[];
  /** Its finished working sets (never a warm-up); a drop set marked. */
  sets: { weightKg: number | null; reps: number | null; isDrop: boolean }[];
}

/**
 * What Muscle Activity works from: every exercise in the person's finished, undeleted workouts
 * performed since `since` -- weighted, bodyweight and timed alike -- with its finished working
 * sets (warm-ups never count), read from the real tables under RLS (their own rows; a trainer's
 * logging for them included). An exercise with no finished set isn't trained, so it's left out.
 */
export async function fetchMuscleActivity(userId: string, since: Date): Promise<ActivityEntry[]> {
  const workouts = await fetchAllRows<{ id: string; performed_at: string }>((from, to) =>
    supabase
      .from('workouts')
      .select('id, performed_at', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .not('completed_at', 'is', null)
      .gte('performed_at', since.toISOString())
      .order('id')
      .range(from, to),
  );
  if (workouts.length === 0) return [];
  const performedAt = new Map(workouts.map((w) => [w.id, w.performed_at]));

  type Row = {
    id: string;
    workout_id: string;
    exercise_id: string;
    measurement_type: MeasurementType | null;
    exercises: {
      name: string;
      muscle_group: MuscleGroup;
      secondary_muscle_groups: MuscleGroup[] | null;
    } | null;
  };
  const exercises = await fetchAllRowsForIds<Row>([...performedAt.keys()], (ids, from, to) =>
    supabase
      .from('workout_exercises')
      .select(
        'id, workout_id, exercise_id, measurement_type, exercises(name, muscle_group, secondary_muscle_groups)',
        {
          count: 'exact',
        },
      )
      .in('workout_id', ids)
      .is('deleted_at', null)
      .order('id')
      .range(from, to),
  );
  if (exercises.length === 0) return [];

  const sets = await fetchCompletedSetValues(exercises.map((e) => e.id));
  const setsOf = new Map<string, ActivityEntry['sets']>();
  for (const set of sets) {
    const list = setsOf.get(set.workout_exercise_id) ?? [];
    list.push({
      weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
      reps: set.reps,
      isDrop: set.is_drop === true,
    });
    setsOf.set(set.workout_exercise_id, list);
  }

  return exercises
    .filter((e) => (setsOf.get(e.id)?.length ?? 0) > 0)
    .map((e) => ({
      workoutId: e.workout_id,
      performedAt: performedAt.get(e.workout_id)!,
      exerciseId: e.exercise_id,
      exerciseName: e.exercises?.name ?? 'Exercise',
      muscleGroup: e.exercises?.muscle_group ?? 'other',
      secondaryMuscleGroups: e.exercises?.secondary_muscle_groups ?? [],
      measurementType: e.measurement_type ?? 'weight_reps',
      sets: setsOf.get(e.id)!,
    }));
}
