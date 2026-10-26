import { measurementTypeOf, type MeasurementType } from '../exercises/movementTypes';
import { supabase } from '../lib/supabase';
import { holdsMeasurement } from './setValues';
import {
  computeWorkoutTopSets,
  countCompletedExercises,
  type WorkoutTopSet,
} from './recentWorkoutTopSets';
import type { SplitMuscleGroup } from './splitMuscleGroups';
import { computeDurationMinutes } from './topSetSummary';
import type { SetRecord, WorkoutSummary } from './workoutQueries';

export interface EnrichedWorkoutSummary extends WorkoutSummary {
  /** From the workout's tagged split day -- never inferred from its exercises. Null for a workout with no split day tagged. */
  splitDayName: string | null;
  muscleGroups: SplitMuscleGroup[];
  /** Only sets that were actually logged (marked complete, holding what their exercise records: weight and reps, reps, or a time) -- never a raw count of every set row. */
  completedSetCount: number;
  /** Same weight x reps definition as workoutSummary.ts's computeTotalVolumeKg -- weighted exercises only, over the same rows already fetched for completedSetCount, no second query. */
  totalVolumeKg: number;
  /** Null if somehow still incomplete (shouldn't happen for a completed-workout query, but avoids a NaN if it ever does). */
  durationMinutes: number | null;
  /** Distinct (non-deleted) workout_exercise rows -- free from the same workout_exercises fetch completedSetCount/totalVolumeKg already join through, no second query. */
  exerciseCount: number;
  /** Exercises with at least one completed set -- the same batched sets fetch as completedSetCount. */
  completedExerciseCount: number;
  /** One per exercise with a real top set (see computeWorkoutTopSets), in the workout's own exercise order. */
  topSets: WorkoutTopSet[];
}

/**
 * Batch-joins a list of workout summaries (already fetched via
 * fetchWorkoutHistory/fetchWorkoutsForMonth) up to their split day's
 * name/muscle groups and down to their completed-set count and volume --
 * three queries total regardless of how many workouts are in the list,
 * never one request per workout, matching the existing fetchWorkoutDetail
 * pattern of batching a per-parent-row Supabase request into a single
 * grouped fetch. exerciseCount rides along on the same workout_exercises
 * fetch completedSetCount/totalVolumeKg already join through -- not a
 * fourth query.
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
    .select(
      'id, workout_id, exercise_id, order_index, measurement_type, exercises(name, photo_url)',
    )
    .in('workout_id', workoutIds)
    .is('deleted_at', null);
  if (weError) throw new Error(weError.message);

  const workoutIdByExerciseId = new Map<string, string>();
  const exerciseCountByWorkoutId = new Map<string, number>();
  const exerciseInfoById = new Map<
    string,
    {
      exerciseId: string;
      exerciseName: string;
      photoUrl: string | null;
      orderIndex: number;
      measurementType: MeasurementType;
    }
  >();
  for (const we of workoutExercises ?? []) {
    workoutIdByExerciseId.set(we.id, we.workout_id);
    const embedded = we.exercises as unknown as { name: string; photo_url: string | null } | null;
    exerciseInfoById.set(we.id, {
      exerciseId: we.exercise_id,
      exerciseName: embedded?.name ?? '',
      photoUrl: embedded?.photo_url ?? null,
      orderIndex: we.order_index,
      measurementType: measurementTypeOf({
        measurementType: we.measurement_type as MeasurementType | null,
      }),
    });
    exerciseCountByWorkoutId.set(
      we.workout_id,
      (exerciseCountByWorkoutId.get(we.workout_id) ?? 0) + 1,
    );
  }

  const completedSetCountByWorkoutId = new Map<string, number>();
  const totalVolumeKgByWorkoutId = new Map<string, number>();
  const setsByWorkoutExerciseId = new Map<string, SetRecord[]>();
  const workoutExerciseIds = Array.from(workoutIdByExerciseId.keys());
  if (workoutExerciseIds.length > 0) {
    const { data: sets, error: setsError } = await supabase
      .from('sets')
      .select(
        'id, workout_exercise_id, set_index, side, weight_kg, reps, duration_seconds, completed_at',
      )
      .in('workout_exercise_id', workoutExerciseIds)
      .is('deleted_at', null)
      .not('completed_at', 'is', null);
    if (setsError) throw new Error(setsError.message);
    for (const set of sets ?? []) {
      const type = exerciseInfoById.get(set.workout_exercise_id)?.measurementType ?? 'weight_reps';
      const record: SetRecord = {
        id: set.id,
        setIndex: set.set_index,
        side: set.side === 'none' ? null : set.side,
        weightKg: set.weight_kg === null ? null : Number(set.weight_kg),
        reps: set.reps === null ? null : Number(set.reps),
        durationSeconds: set.duration_seconds ?? null,
        completedAt: set.completed_at,
      };
      // Only a set holding what its exercise records counts as logged.
      if (!holdsMeasurement(record, type)) continue;
      const bucket = setsByWorkoutExerciseId.get(set.workout_exercise_id) ?? [];
      bucket.push(record);
      setsByWorkoutExerciseId.set(set.workout_exercise_id, bucket);

      const workoutId = workoutIdByExerciseId.get(set.workout_exercise_id);
      if (!workoutId) continue;
      completedSetCountByWorkoutId.set(
        workoutId,
        (completedSetCountByWorkoutId.get(workoutId) ?? 0) + 1,
      );
      // Volume is weight x reps: weighted exercises only.
      if (type === 'weight_reps') {
        totalVolumeKgByWorkoutId.set(
          workoutId,
          (totalVolumeKgByWorkoutId.get(workoutId) ?? 0) + record.weightKg! * record.reps!,
        );
      }
    }
  }

  const exerciseRowsByWorkoutId = new Map<
    string,
    {
      exerciseId: string;
      exerciseName: string;
      photoUrl: string | null;
      sets: SetRecord[];
      orderIndex: number;
      measurementType: MeasurementType;
    }[]
  >();
  for (const [weId, workoutId] of workoutIdByExerciseId) {
    const info = exerciseInfoById.get(weId);
    if (!info) continue;
    const rows = exerciseRowsByWorkoutId.get(workoutId) ?? [];
    rows.push({ ...info, sets: setsByWorkoutExerciseId.get(weId) ?? [] });
    exerciseRowsByWorkoutId.set(workoutId, rows);
  }

  return workouts.map((workout) => {
    const day = workout.workoutSplitDayId ? splitDayInfo.get(workout.workoutSplitDayId) : undefined;
    const exerciseRows = (exerciseRowsByWorkoutId.get(workout.id) ?? []).sort(
      (a, b) => a.orderIndex - b.orderIndex,
    );
    return {
      ...workout,
      splitDayName: day?.name ?? null,
      muscleGroups: day?.muscleGroups ?? [],
      completedSetCount: completedSetCountByWorkoutId.get(workout.id) ?? 0,
      totalVolumeKg: totalVolumeKgByWorkoutId.get(workout.id) ?? 0,
      durationMinutes: computeDurationMinutes(workout.performedAt, workout.completedAt),
      exerciseCount: exerciseCountByWorkoutId.get(workout.id) ?? 0,
      completedExerciseCount: countCompletedExercises(exerciseRows),
      topSets: computeWorkoutTopSets(exerciseRows),
    };
  });
}
