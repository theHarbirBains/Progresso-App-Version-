import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PlannedExercise } from './splitPlanQueries';

// A workout started from a split day that has a plan (its exercises and how many sets) runs as a
// guided workout: it starts on the plan's first exercise with one set ready, only the exercise
// being done is open (the ones done fold away above it), the next planned exercise waits in an
// Up Next card -- one tap to start it, or another from the plan -- and each exercise's next set
// adds itself once the one before is filled in, up to the sets planned. A day with no plan, or a
// workout started any other way, is the usual live workout.
//
// Which workouts are guided is kept on this device (like the typed drafts), set as the workout
// starts and forgotten when it's finished or cancelled; opened elsewhere it's the usual live
// workout, nothing lost.

const keyFor = (workoutId: string) => `@progresso/guidedWorkout/${workoutId}`;

/** Marks a workout as guided. A storage failure only means it opens as the usual live workout. */
export async function markGuided(workoutId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(workoutId), '1');
  } catch {
    // Non-critical.
  }
}

/** Whether a workout was started guided on this device. */
export async function isGuided(workoutId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(workoutId))) === '1';
  } catch {
    return false;
  }
}

/** Forgets a guided workout once it's finished or cancelled. */
export async function forgetGuided(workoutId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(workoutId));
  } catch {
    // Non-critical.
  }
}

/**
 * The plan's exercises not started yet, in plan order: each exercise in the workout uses up one
 * planned entry for it, so a plan with the same exercise twice keeps the second.
 */
export function remainingPlan(
  plan: readonly PlannedExercise[],
  inWorkout: readonly { exerciseId: string }[],
): PlannedExercise[] {
  const started = new Map<string, number>();
  for (const exercise of inWorkout) {
    started.set(exercise.exerciseId, (started.get(exercise.exerciseId) ?? 0) + 1);
  }
  return plan.filter((planned) => {
    const left = started.get(planned.exerciseId) ?? 0;
    if (left === 0) return true;
    started.set(planned.exerciseId, left - 1);
    return false;
  });
}

/** How many sets the plan has for an exercise, or null for one that isn't in the plan. */
export function plannedSetsFor(
  plan: readonly PlannedExercise[],
  exerciseId: string,
): number | null {
  return plan.find((planned) => planned.exerciseId === exerciseId)?.targetSets ?? null;
}
