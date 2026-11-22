import { supabase } from '../lib/supabase';
import { addPlannedExercises } from '../workouts/splitPlanQueries';
import {
  createWorkoutSplit,
  createWorkoutSplitDay,
  deleteWorkoutSplit,
  setWorkoutSplitDayMuscleGroups,
  type WorkoutSplitSummary,
} from '../workouts/workoutSplitQueries';
import { splitNameFor } from './programs';
import type { ProgramVariation, WorkoutProgram } from './programTypes';

/** The built-ins' ids, by slug -- every slug asked for, or it says which aren't there. */
async function builtinIds(slugs: readonly string[]): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, slug')
    .in('slug', [...slugs])
    .is('created_by', null);
  if (error) throw new Error(error.message);
  const ids = new Map(((data ?? []) as { id: string; slug: string }[]).map((r) => [r.slug, r.id]));
  const missing = slugs.filter((slug) => !ids.has(slug));
  if (missing.length > 0) {
    throw new Error("This program uses an exercise that isn't available yet. Try another program.");
  }
  return ids;
}

/**
 * Makes a program's variation an ordinary split of the person's own -- named for the program,
 * with each day's name, muscle groups and planned exercises (each with its sets) -- exactly as
 * if they'd built it themselves, so it works everywhere a split does (Start Workout, the guided
 * workout, Next Workout) and can be changed like any other. Nothing else they have is touched.
 * A split half made when something fails is taken away again. Making it the active split is the
 * caller's (a profile change).
 */
export async function activateProgram(
  userId: string,
  program: WorkoutProgram,
  variation: ProgramVariation,
): Promise<WorkoutSplitSummary> {
  const slugs = [...new Set(variation.days.flatMap((day) => day.exercises.map((e) => e.slug)))];
  const ids = await builtinIds(slugs);
  const split = await createWorkoutSplit(userId, splitNameFor(program, variation));
  try {
    for (let i = 0; i < variation.days.length; i++) {
      const day = variation.days[i]!;
      const newDay = await createWorkoutSplitDay(split.id, day.name, i + 1);
      if (day.muscleGroups.length > 0) {
        await setWorkoutSplitDayMuscleGroups(newDay.id, day.muscleGroups);
      }
      await addPlannedExercises(
        newDay.id,
        day.exercises.map((exercise) => ({
          exerciseId: ids.get(exercise.slug)!,
          targetSets: exercise.sets,
        })),
      );
    }
  } catch (error) {
    await deleteWorkoutSplit(split.id).catch(() => undefined);
    throw error;
  }
  return split;
}
