import type { MuscleGroup } from '../exercises/muscleGroups';
import type { HistoricalSetWithExercise } from '../workouts/allExerciseHistoryQueries';

/**
 * Minimum reps for a completed set to qualify as this exercise's "Top Set".
 * There is no per-exercise configured rep range anywhere in Progresso's
 * data model (no such column on `exercises`, no config UI) -- this is a
 * fixed, global threshold instead, per explicit product decision.
 */
export const TOP_SET_MIN_REPS = 5;

export interface TopSetRow {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  weightKg: number;
  reps: number;
  performedAt: string;
}

/**
 * One row per exercise: the heaviest completed set with at least
 * TOP_SET_MIN_REPS reps. Exercises with no qualifying set are omitted
 * entirely -- never a fabricated/zero row. Ties on weight break toward the
 * higher rep count, then the more recent date, so the pick is fully
 * deterministic. Output is sorted alphabetically by exercise name (this
 * page's default/only ordering).
 *
 * Takes the same raw per-set history every other Progress section already
 * fetches once (fetchAllExerciseHistory) -- no separate query, and no
 * left/right merging: a unilateral exercise's sets stay exactly as logged
 * (each one its own row in `history`), same as every other Progress
 * derivation (StrengthSection/PRsSection/ExercisesSection) already treats
 * them, since the data model has no per-set side field for this feed to
 * begin with.
 */
export function computeTopSets(history: HistoricalSetWithExercise[]): TopSetRow[] {
  const bestByExercise = new Map<string, TopSetRow>();
  for (const s of history) {
    if (s.reps < TOP_SET_MIN_REPS) continue;
    const current = bestByExercise.get(s.exerciseId);
    const isBetter =
      !current ||
      s.weightKg > current.weightKg ||
      (s.weightKg === current.weightKg && s.reps > current.reps) ||
      (s.weightKg === current.weightKg &&
        s.reps === current.reps &&
        new Date(s.performedAt).getTime() > new Date(current.performedAt).getTime());
    if (isBetter) {
      bestByExercise.set(s.exerciseId, {
        exerciseId: s.exerciseId,
        exerciseName: s.exerciseName,
        muscleGroup: s.muscleGroup,
        weightKg: s.weightKg,
        reps: s.reps,
        performedAt: s.performedAt,
      });
    }
  }
  return Array.from(bestByExercise.values()).sort((a, b) =>
    a.exerciseName.localeCompare(b.exerciseName),
  );
}
