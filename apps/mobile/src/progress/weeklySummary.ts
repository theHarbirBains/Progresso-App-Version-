import { MUSCLE_GROUP_LABELS, type MuscleGroup } from '../exercises/muscleGroups';
import {
  computeWeeklyCalorieSummary,
  type WeeklyCalorieSummary,
} from '../nutrition/nutritionCalculations';

// A week's summary: what was trained and eaten, Monday to Sunday, in plain numbers. Pure, no
// I/O -- every figure is a count, a sum or an average of what was logged. It describes what
// happened, never why, and never judges it.

/** How many weeks before the summarised one its averages and bests are taken from. */
export const COMPARISON_WEEKS = 4;
/** A day's calories count as within the target when they're no more than this share off it. */
export const CALORIE_TOLERANCE = 0.1;
/** How many lifts the Strength part shows. */
export const MAIN_LIFTS = 3;

/** A completed set, with the workout and exercise it belongs to. */
export interface SummarySet {
  workoutId: string;
  performedAt: string;
  exerciseId: string;
  exerciseName: string;
  muscleGroup: MuscleGroup;
  measurementType: 'weight_reps' | 'bodyweight' | 'timed';
  weightKg: number | null;
  reps: number | null;
}

/** A completed workout. */
export interface SummaryWorkout {
  id: string;
  performedAt: string;
}

/** A food log's figures, as the week needs them. */
export interface SummaryFoodLog {
  loggedAt: string;
  calories: number;
  proteinG: number;
}

export interface WeeklySummaryInput {
  /** Monday 00:00 to the next Monday 00:00, local time. */
  week: { start: Date; end: Date };
  /** Completed workouts from COMPARISON_WEEKS before the week to its end. */
  workouts: SummaryWorkout[];
  /** Their completed sets. */
  sets: SummarySet[];
  /** The week's food logs. */
  foodLogs: SummaryFoodLog[];
  dailyCalorieTarget: number | null;
  dailyProteinTarget: number | null;
  /** How many days a week the user means to train (Workout Preferences). */
  weeklyWorkoutGoal: number | null;
}

export interface MuscleGroupWeek {
  group: MuscleGroup;
  label: string;
  /** Completed sets this week. */
  sets: number;
  /** Completed sets per week over the COMPARISON_WEEKS before it. */
  averageSets: number;
}

export interface LiftWeek {
  exerciseId: string;
  exerciseName: string;
  /** The week's heaviest completed set (most reps breaks a tie). */
  top: { weightKg: number; reps: number };
  /** The same over the COMPARISON_WEEKS before -- null when it wasn't done then. */
  previousBest: { weightKg: number; reps: number } | null;
}

export interface WeeklySummary {
  training: {
    /** Different days with a completed workout. */
    workoutDays: number;
    workouts: number;
    sets: number;
    goalDays: number | null;
  };
  nutrition: {
    /** Days with at least one food logged -- only these are counted below. */
    loggedDays: number;
    avgCalories: number | null;
    avgProteinG: number | null;
    /** Logged days within CALORIE_TOLERANCE of the calorie target; null with no target. */
    daysWithinCalories: number | null;
    /** Logged days that reached the protein target; null with no target. */
    daysProteinMet: number | null;
    /** The week's calories against 7 times the daily target; null with no target. */
    budget: WeeklyCalorieSummary | null;
  };
  /** Most sets this week first; a group trained only in the weeks before is listed too. */
  muscleGroups: MuscleGroupWeek[];
  strength: LiftWeek[];
  /** Nothing trained and nothing eaten that week. */
  isEmpty: boolean;
}

/** Monday 00:00 (local) of the week `weeksAgo` before the one `now` falls in, to the next Monday. */
export function weekRange(now: Date, weeksAgo = 0): { start: Date; end: Date } {
  const day = now.getDay(); // 0 = Sunday .. 6 = Saturday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + mondayOffset - weeksAgo * 7,
  );
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start, end };
}

function dayKey(iso: string): string {
  const at = new Date(iso);
  return `${at.getFullYear()}-${at.getMonth()}-${at.getDate()}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function heavier(
  a: { weightKg: number; reps: number },
  b: { weightKg: number; reps: number },
): boolean {
  return a.weightKg > b.weightKg || (a.weightKg === b.weightKg && a.reps > b.reps);
}

export function computeWeeklySummary(input: WeeklySummaryInput): WeeklySummary {
  const { week } = input;
  const weekStart = week.start.getTime();
  const weekEnd = week.end.getTime();
  // Calendar days, not a fixed number of milliseconds, so a clock change doesn't move it.
  const comparisonStart = new Date(
    week.start.getFullYear(),
    week.start.getMonth(),
    week.start.getDate() - COMPARISON_WEEKS * 7,
  ).getTime();
  const inWeek = (iso: string) => {
    const t = Date.parse(iso);
    return t >= weekStart && t < weekEnd;
  };
  const before = (iso: string) => {
    const t = Date.parse(iso);
    return t >= comparisonStart && t < weekStart;
  };

  // Training.
  const weekWorkouts = input.workouts.filter((workout) => inWeek(workout.performedAt));
  const weekSets = input.sets.filter((set) => inWeek(set.performedAt));
  const earlierSets = input.sets.filter((set) => before(set.performedAt));
  const training = {
    workoutDays: new Set(weekWorkouts.map((workout) => dayKey(workout.performedAt))).size,
    workouts: weekWorkouts.length,
    sets: weekSets.length,
    goalDays: input.weeklyWorkoutGoal,
  };

  // Nutrition, by logged day.
  const days = new Map<string, { calories: number; proteinG: number }>();
  for (const log of input.foodLogs) {
    if (!inWeek(log.loggedAt)) continue;
    const key = dayKey(log.loggedAt);
    const day = days.get(key) ?? { calories: 0, proteinG: 0 };
    day.calories += log.calories;
    day.proteinG += log.proteinG;
    days.set(key, day);
  }
  const dayTotals = [...days.values()];
  const loggedDays = dayTotals.length;
  const totalCalories = dayTotals.reduce((sum, day) => sum + day.calories, 0);
  const totalProtein = dayTotals.reduce((sum, day) => sum + day.proteinG, 0);
  const calorieTarget = input.dailyCalorieTarget;
  const proteinTarget = input.dailyProteinTarget;
  const nutrition = {
    loggedDays,
    avgCalories: loggedDays > 0 ? Math.round(totalCalories / loggedDays) : null,
    avgProteinG: loggedDays > 0 ? Math.round(totalProtein / loggedDays) : null,
    daysWithinCalories:
      calorieTarget === null
        ? null
        : dayTotals.filter(
            (day) => Math.abs(day.calories - calorieTarget) <= calorieTarget * CALORIE_TOLERANCE,
          ).length,
    daysProteinMet:
      proteinTarget === null
        ? null
        : dayTotals.filter((day) => day.proteinG >= proteinTarget).length,
    budget: computeWeeklyCalorieSummary(totalCalories, calorieTarget),
  };

  // Muscle groups: sets this week against the weekly average before it.
  const groupSets = new Map<MuscleGroup, { sets: number; earlier: number }>();
  for (const set of weekSets) {
    const entry = groupSets.get(set.muscleGroup) ?? { sets: 0, earlier: 0 };
    entry.sets += 1;
    groupSets.set(set.muscleGroup, entry);
  }
  for (const set of earlierSets) {
    const entry = groupSets.get(set.muscleGroup) ?? { sets: 0, earlier: 0 };
    entry.earlier += 1;
    groupSets.set(set.muscleGroup, entry);
  }
  const muscleGroups = [...groupSets.entries()]
    .map(([group, entry]) => ({
      group,
      label: MUSCLE_GROUP_LABELS[group],
      sets: entry.sets,
      averageSets: round1(entry.earlier / COMPARISON_WEEKS),
    }))
    .sort((a, b) => b.sets - a.sets || b.averageSets - a.averageSets);

  // Strength: the weighted lifts trained this week that have the most sets lately.
  const weighted = (set: SummarySet) =>
    set.measurementType === 'weight_reps' && set.weightKg !== null && set.reps !== null;
  const liftSets = new Map<string, { name: string; count: number }>();
  for (const set of [...weekSets, ...earlierSets]) {
    if (!weighted(set)) continue;
    const entry = liftSets.get(set.exerciseId) ?? { name: set.exerciseName, count: 0 };
    entry.count += 1;
    liftSets.set(set.exerciseId, entry);
  }
  const best = (sets: SummarySet[], exerciseId: string) => {
    let top: { weightKg: number; reps: number } | null = null;
    for (const set of sets) {
      if (set.exerciseId !== exerciseId || !weighted(set)) continue;
      const candidate = { weightKg: set.weightKg!, reps: set.reps! };
      if (!top || heavier(candidate, top)) top = candidate;
    }
    return top;
  };
  const trainedThisWeek = new Set(weekSets.filter(weighted).map((set) => set.exerciseId));
  const strength = [...liftSets.entries()]
    .filter(([exerciseId]) => trainedThisWeek.has(exerciseId))
    .sort((a, b) => b[1].count - a[1].count || a[1].name.localeCompare(b[1].name))
    .slice(0, MAIN_LIFTS)
    .map(([exerciseId, entry]) => ({
      exerciseId,
      exerciseName: entry.name,
      top: best(weekSets, exerciseId)!,
      previousBest: best(earlierSets, exerciseId),
    }));

  return {
    training,
    nutrition,
    muscleGroups,
    strength,
    isEmpty: training.workouts === 0 && loggedDays === 0,
  };
}
