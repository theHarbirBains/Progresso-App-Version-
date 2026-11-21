import { isoToLocalDateKey } from '../design/calendarGrid';
import type { MeasurementType } from '../exercises/movementTypes';
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import { bestLoggedSet, loggedSets } from './setValues';
import type { SetRecord } from './workoutQueries';

// Previous exercises (explicitly requested): the first thing Add Exercise shows in a live
// workout -- what the person did the last time they trained each muscle group, so they pick up
// where they left off with the very same exercises. Pure; the rows come from the database's
// previous_exercises_by_muscle_group (previousExerciseQueries.ts).
//
// "The last time" for a muscle group is the latest day a finished workout trained it -- every
// workout that day, so a morning and an evening session are one -- and an exercise trains only
// its own muscle group (exercises.muscle_group), never a secondary one, as everywhere else.
// Exercises are kept by their own id: two variations are two exercises, never merged by name.

/** One exercise done in one finished workout, with its working sets. */
export interface PreviousExerciseRow {
  muscleGroup: MuscleGroup;
  workoutId: string;
  performedAt: string;
  /** Who logged it, when it wasn't the person: their trainer. Null for their own logging. */
  loggedBy: string | null;
  workoutExerciseId: string;
  exerciseId: string;
  orderIndex: number;
  measurementType: MeasurementType;
  sets: SetRecord[];
}

/** An exercise as last done: its sets and its best one (the Top Set, for weight and reps). */
export interface PreviousExercise {
  exerciseId: string;
  performedAt: string;
  measurementType: MeasurementType;
  /** Working sets done -- a one-side-at-a-time exercise's two sides are one set. */
  setCount: number;
  best: SetRecord | null;
  /** Logged by their trainer, not by them. */
  byTrainer: boolean;
}

/** A muscle group's last time: when, and the exercises done for it that day, in order. */
export interface PreviousMuscleGroup {
  muscleGroup: MuscleGroup;
  lastTrainedAt: string;
  exercises: PreviousExercise[];
}

/**
 * Each muscle group's last time, most recently trained first. `userId` is whose history it is:
 * anyone else's logging in it is their trainer's.
 */
export function previousByMuscleGroup(
  rows: PreviousExerciseRow[],
  userId: string,
): PreviousMuscleGroup[] {
  const byGroup = new Map<MuscleGroup, PreviousExerciseRow[]>();
  for (const row of rows) {
    const list = byGroup.get(row.muscleGroup) ?? [];
    list.push(row);
    byGroup.set(row.muscleGroup, list);
  }
  const groups: PreviousMuscleGroup[] = [];
  for (const [muscleGroup, list] of byGroup) {
    const latest = list.reduce((a, b) =>
      Date.parse(b.performedAt) > Date.parse(a.performedAt) ? b : a,
    );
    const day = isoToLocalDateKey(latest.performedAt);
    // That day's workouts in the order they were done, each one's exercises in its own order.
    const thatDay = list
      .filter((row) => isoToLocalDateKey(row.performedAt) === day)
      .sort(
        (a, b) =>
          Date.parse(a.performedAt) - Date.parse(b.performedAt) || a.orderIndex - b.orderIndex,
      );
    const exercises: PreviousExercise[] = [];
    const at = new Map<string, number>();
    for (const row of thatDay) {
      const done = loggedSets(row.sets, row.measurementType);
      if (done.length === 0) continue;
      const exercise: PreviousExercise = {
        exerciseId: row.exerciseId,
        performedAt: row.performedAt,
        measurementType: row.measurementType,
        setCount: new Set(done.map((set) => set.setIndex)).size,
        best: bestLoggedSet(done, row.measurementType),
        byTrainer: row.loggedBy !== null && row.loggedBy !== userId,
      };
      // Done twice that day: where it was first done, as it was done last.
      const index = at.get(row.exerciseId);
      if (index === undefined) {
        at.set(row.exerciseId, exercises.length);
        exercises.push(exercise);
      } else {
        exercises[index] = exercise;
      }
    }
    if (exercises.length > 0) {
      groups.push({ muscleGroup, lastTrainedAt: latest.performedAt, exercises });
    }
  }
  return groups.sort((a, b) => Date.parse(b.lastTrainedAt) - Date.parse(a.lastTrainedAt));
}

/** What the workout tells about what's being trained. */
export interface PreviousContext {
  /** The split day's muscle groups, in its order (the library's vocabulary). Empty without one. */
  dayGroups: MuscleGroup[];
  /** The muscle groups of the exercises already in the workout, in the order they were added. */
  addedGroups: MuscleGroup[];
}

/** One muscle group's heading and exercises; no history leaves it empty. */
export interface PreviousSection {
  muscleGroup: MuscleGroup;
  lastTrainedAt: string | null;
  exercises: PreviousExercise[];
}

export interface PreviousPlan {
  /** A split day's muscle groups, or every muscle group trained. */
  mode: 'day' | 'open';
  title: string;
  sections: PreviousSection[];
  /** How many sections show before Show More. */
  initialCount: number;
}

/** Muscle groups shown at first without a split day, besides the ones already being trained. */
export const OPEN_SECTIONS = 3;

/** "Chest", "Chest & Triceps", "Chest, Shoulders & Triceps". */
export function muscleGroupList(groups: MuscleGroup[]): string {
  const labels = groups.map((group) => MUSCLE_GROUP_LABELS[group]);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} & ${labels[labels.length - 1]}`;
}

const unique = <T>(items: T[]) => Array.from(new Set(items));

/**
 * What Add Exercise shows. On a split day, the day's muscle groups -- each one, with or without
 * history -- then any other muscle group already in the workout, and nothing unrelated. Without
 * one, every muscle group trained: those already in the workout first, then the most recently
 * trained, the first few shown and the rest behind Show More.
 */
export function planPreviousExercises(
  groups: PreviousMuscleGroup[],
  context: PreviousContext,
): PreviousPlan {
  const byGroup = new Map(groups.map((group) => [group.muscleGroup, group]));
  const sectionFor = (muscleGroup: MuscleGroup): PreviousSection => {
    const found = byGroup.get(muscleGroup);
    return {
      muscleGroup,
      lastTrainedAt: found?.lastTrainedAt ?? null,
      exercises: found?.exercises ?? [],
    };
  };
  const dayGroups = unique(context.dayGroups);
  const added = unique(context.addedGroups).filter((group) => byGroup.has(group));

  if (dayGroups.length > 0) {
    const sections = [
      ...dayGroups.map(sectionFor),
      ...added.filter((group) => !dayGroups.includes(group)).map(sectionFor),
    ];
    return {
      mode: 'day',
      title: `Last Time You Trained — ${muscleGroupList(dayGroups)}`,
      sections,
      initialCount: sections.length,
    };
  }

  const rest = groups.map((group) => group.muscleGroup).filter((group) => !added.includes(group));
  const sections = [...added, ...rest].map(sectionFor);
  return {
    mode: 'open',
    title: 'Your Previous Exercises',
    sections,
    initialCount: Math.min(sections.length, Math.max(OPEN_SECTIONS, added.length)),
  };
}
