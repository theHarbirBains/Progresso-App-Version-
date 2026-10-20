import type { MeasurementType, MovementType } from '../exercises/movementTypes';
import type { MuscleGroup } from '../exercises/muscleGroups';
import { supabase } from '../lib/supabase';
import { addExerciseToWorkout, createSet } from './workoutQueries';

// A split day's plan (workout_split_day_exercises): the exercises to do that day, in order, each
// with how many sets. Kept apart from the day itself (its name and muscle groups). Starting the
// day adds the plan to the new workout; from then on the workout is its own record, so changing
// a plan never changes a workout already done. Direct-to-Supabase, own rows only.

export interface PlannedExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  movementType: MovementType;
  measurementType: MeasurementType;
  position: number;
  targetSets: number;
}

interface PlannedDbRow {
  id: string;
  workout_split_day_id: string;
  exercise_id: string;
  position: number;
  target_sets: number;
  exercises: {
    name: string;
    muscle_group: MuscleGroup;
    movement_type: MovementType;
    measurement_type: MeasurementType | null;
  } | null;
}

const COLUMNS =
  'id, workout_split_day_id, exercise_id, position, target_sets, exercises(name, muscle_group, movement_type, measurement_type)';

function toPlanned(row: PlannedDbRow): PlannedExercise {
  const exercise = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    exerciseName: exercise?.name ?? 'Exercise',
    muscleGroup: exercise?.muscle_group ?? 'other',
    movementType: exercise?.movement_type ?? 'bilateral',
    measurementType: exercise?.measurement_type ?? 'weight_reps',
    position: row.position,
    targetSets: row.target_sets,
  };
}

function byPosition(a: PlannedExercise, b: PlannedExercise): number {
  return a.position - b.position;
}

/** One day's plan, in order. */
export async function fetchDayPlan(dayId: string): Promise<PlannedExercise[]> {
  const { data, error } = await supabase
    .from('workout_split_day_exercises')
    .select(COLUMNS)
    .eq('workout_split_day_id', dayId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as PlannedDbRow[]).map(toPlanned).sort(byPosition);
}

/** Every day's plan in these days, by day -- for a split's overview. */
export async function fetchPlansForDays(dayIds: string[]): Promise<Map<string, PlannedExercise[]>> {
  const plans = new Map<string, PlannedExercise[]>(dayIds.map((id) => [id, []]));
  if (dayIds.length === 0) return plans;
  const { data, error } = await supabase
    .from('workout_split_day_exercises')
    .select(COLUMNS)
    .in('workout_split_day_id', dayIds);
  if (error) throw new Error(error.message);
  for (const row of (data ?? []) as unknown as PlannedDbRow[]) {
    plans.get(row.workout_split_day_id)?.push(toPlanned(row));
  }
  for (const list of plans.values()) list.sort(byPosition);
  return plans;
}

/** Adds an exercise to the end of a day's plan. The owner is set by trigger. */
export async function addPlannedExercise(
  dayId: string,
  exerciseId: string,
  position: number,
  targetSets = 3,
): Promise<PlannedExercise> {
  const { data, error } = await supabase
    .from('workout_split_day_exercises')
    .insert({
      workout_split_day_id: dayId,
      exercise_id: exerciseId,
      position,
      target_sets: targetSets,
    })
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return toPlanned(data as unknown as PlannedDbRow);
}

export async function setPlannedSets(plannedId: string, targetSets: number): Promise<void> {
  const { error } = await supabase
    .from('workout_split_day_exercises')
    .update({ target_sets: targetSets })
    .eq('id', plannedId);
  if (error) throw new Error(error.message);
}

export async function removePlannedExercise(plannedId: string): Promise<void> {
  const { error } = await supabase.from('workout_split_day_exercises').delete().eq('id', plannedId);
  if (error) throw new Error(error.message);
}

/** Saves a new order: each planned exercise's position. */
export async function reorderPlan(items: { id: string; position: number }[]): Promise<void> {
  for (const item of items) {
    const { error } = await supabase
      .from('workout_split_day_exercises')
      .update({ position: item.position })
      .eq('id', item.id);
    if (error) throw new Error(error.message);
  }
}

/** Copies one day's plan onto another -- duplicating a split. */
export async function copyDayPlan(fromDayId: string, toDayId: string): Promise<void> {
  const plan = await fetchDayPlan(fromDayId);
  if (plan.length === 0) return;
  const { error } = await supabase.from('workout_split_day_exercises').insert(
    plan.map((planned) => ({
      workout_split_day_id: toDayId,
      exercise_id: planned.exerciseId,
      position: planned.position,
      target_sets: planned.targetSets,
    })),
  );
  if (error) throw new Error(error.message);
}

/**
 * Puts a day's plan into a workout just started for that day: each exercise in order, with its
 * sets ready to fill (a unilateral exercise's set is a left and a right). The sets are blank --
 * the live workout fills them in from last time, as it does for a set added by hand.
 */
export async function applyPlanToWorkout(
  workoutId: string,
  plan: PlannedExercise[],
): Promise<void> {
  for (const [index, planned] of plan.entries()) {
    const workoutExerciseId = await addExerciseToWorkout(workoutId, planned.exerciseId, index + 1);
    for (let setIndex = 1; setIndex <= planned.targetSets; setIndex++) {
      if (planned.movementType === 'unilateral') {
        await createSet(workoutExerciseId, setIndex, 'left');
        await createSet(workoutExerciseId, setIndex, 'right');
      } else {
        await createSet(workoutExerciseId, setIndex);
      }
    }
  }
}
