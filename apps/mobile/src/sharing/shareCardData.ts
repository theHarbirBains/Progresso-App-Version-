import { MUSCLE_GROUP_LABELS } from '../exercises/muscleGroups';
import { fetchOneRepMax, fetchRepPRs } from '../workouts/prQueries';
import { fetchWorkoutDetail, type SetRecord } from '../workouts/workoutQueries';

// Pure data assembly for the workout share card. Every value here comes from
// an existing query/definition (workoutQueries.ts, prQueries.ts,
// muscleGroups.ts) -- the same top-set (heaviest weightKg) and PR
// (source_set_id match) definitions already used by WorkoutDetailScreen and
// the Dashboard's recentWorkoutInfo.ts. No new PR logic, no estimated 1RM,
// no invented metrics. Rendering (ShareWorkoutScreen.tsx) and native
// capture/share are deliberately kept out of this file.

export interface ShareTopSet {
  exerciseName: string;
  weightKg: number;
  reps: number;
  /** "8 Rep PR" / "1RM" when this set is CURRENTLY the live record -- never "estimated". */
  prLabel: string | null;
}

export interface ShareCardData {
  workoutName: string;
  performedAt: string;
  musclesTrained: string;
  durationMinutes: number | null;
  /** Up to 5 exercises, in the workout's existing order -- never re-sorted by weight. */
  topSets: ShareTopSet[];
}

const MAX_EXERCISES = 5;

function heaviestSet(sets: SetRecord[]): SetRecord | null {
  return sets.reduce<SetRecord | null>(
    (max, s) => (!max || s.weightKg > max.weightKg ? s : max),
    null,
  );
}

function computeDurationMinutes(performedAt: string, completedAt: string | null): number | null {
  if (!completedAt) return null;
  const ms = new Date(completedAt).getTime() - new Date(performedAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

/**
 * Assembles the share card's data. Throws if the workout is not completed --
 * sharing an in-progress workout is never allowed, so there is no
 * "incomplete workout" return shape for callers to accidentally render.
 */
export async function fetchShareCardData(
  workoutId: string,
  userId: string,
): Promise<ShareCardData> {
  const detail = await fetchWorkoutDetail(workoutId);
  if (!detail.completedAt) {
    throw new Error('Only completed workouts can be shared');
  }

  const musclesTrained = Array.from(
    new Set(detail.exercises.map((e) => MUSCLE_GROUP_LABELS[e.muscleGroup])),
  ).join(', ');

  const durationMinutes = computeDurationMinutes(detail.performedAt, detail.completedAt);

  const shownExercises = detail.exercises.slice(0, MAX_EXERCISES);
  const topSets = (
    await Promise.all(
      shownExercises.map(async (exercise): Promise<ShareTopSet | null> => {
        const topSet = heaviestSet(exercise.sets);
        if (!topSet) return null;

        const [repPRs, oneRepMax] = await Promise.all([
          fetchRepPRs(userId, exercise.exerciseId),
          fetchOneRepMax(userId, exercise.exerciseId),
        ]);

        let prLabel: string | null = null;
        if (topSet.reps === 1) {
          if (oneRepMax?.sourceSetId === topSet.id) prLabel = '1RM';
        } else {
          const matching = repPRs.find((pr) => pr.reps === topSet.reps);
          if (matching?.sourceSetId === topSet.id) prLabel = `${topSet.reps} Rep PR`;
        }

        return {
          exerciseName: exercise.exerciseName,
          weightKg: topSet.weightKg,
          reps: topSet.reps,
          prLabel,
        };
      }),
    )
  ).filter((entry): entry is ShareTopSet => entry !== null);

  return {
    workoutName: detail.name,
    performedAt: detail.performedAt,
    musclesTrained,
    durationMinutes,
    topSets,
  };
}
