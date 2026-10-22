import type { NutritionGoalValues, NutritionTotals } from '../nutrition/nutritionCalculations';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import type { NextWorkoutPlan } from '../workouts/nextWorkout';
import { withWidgets } from './loadWidgets';
import {
  clockTime,
  nutritionTimeline,
  SIGNED_OUT_NEXT_WORKOUT,
  SIGNED_OUT_NUTRITION,
  SIGNED_OUT_STEPS,
  stepsTimeline,
  type NextWorkoutWidgetProps,
} from './widgetProps';
import { endWorkoutActivities } from './workoutActivity';

// What the home-screen widgets show, handed over by the app whenever it learns something new:
// today's food log or targets change (WidgetSync), Feed finds the next or open workout, the live
// workout opens or ends, Feed reads today's steps. A widget can't fetch for itself, so it shows
// what it was last handed until the app hands it something newer. Updating a widget never gets
// in the way of what the person is doing (loadWidgets.ts): the returned promise never rejects.

/** Today's Nutrition: what's been eaten against the daily targets, and a fresh day from midnight. */
export function showNutritionWidget(
  eaten: NutritionTotals,
  targets: NutritionGoalValues,
  now = new Date(),
): Promise<void> {
  return withWidgets('nutrition', ({ nutritionWidget }) =>
    nutritionWidget.updateTimeline(nutritionTimeline(eaten, targets, now)),
  );
}

/** Today's Steps: the count just read from Apple Health, or null without access. */
export function showStepsWidget(steps: number | null, now = new Date()): Promise<void> {
  return withWidgets('steps', ({ stepsWidget }) =>
    stepsWidget.updateTimeline(stepsTimeline(steps, now)),
  );
}

/** A workout that is going, on the Next Workout widget, with Resume. */
export interface OpenWorkout {
  title: string;
  /** "Your workout", "Group workout". */
  kind: string;
  startedAt: string | null;
  url: string;
}

/** The Next Workout widget's props: the open workout first, else the next day of the split. */
export function nextWorkoutProps(
  open: OpenWorkout | null,
  plan: NextWorkoutPlan | null,
): NextWorkoutWidgetProps {
  if (open) {
    return {
      signedIn: true,
      eyebrow: 'Workout in Progress',
      title: open.title,
      detail: open.startedAt
        ? `${open.kind} · started ${clockTime(new Date(open.startedAt))}`
        : open.kind,
      action: 'Resume',
      url: open.url,
    };
  }
  if (plan) {
    const muscles = plan.day.muscleGroups.map((g) => SPLIT_MUSCLE_GROUP_LABELS[g]).join(' • ');
    return {
      signedIn: true,
      eyebrow: 'Next Workout',
      title: plan.day.name,
      detail:
        muscles ||
        (plan.previousDayName ? `Up next after ${plan.previousDayName}` : "Let's get started"),
      action: 'Start',
      url: 'progresso://workouts/new',
    };
  }
  return {
    signedIn: true,
    eyebrow: 'Next Workout',
    title: 'No split yet',
    detail: 'Choose a split in Progresso to see what’s next.',
    action: 'Open',
    url: 'progresso://feed',
  };
}

/** Next Workout: the workout going, or the split's next day. */
export function showNextWorkoutWidget(
  open: OpenWorkout | null,
  plan: NextWorkoutPlan | null,
): Promise<void> {
  return withWidgets('nextWorkout', ({ nextWorkoutWidget }) =>
    nextWorkoutWidget.updateSnapshot(nextWorkoutProps(open, plan)),
  );
}

/** Signed out: no one's figures stay on the home screen, and no workout card on the Lock Screen. */
export async function clearWidgets(): Promise<void> {
  await withWidgets('signOut', ({ nutritionWidget, nextWorkoutWidget, stepsWidget }) => {
    nutritionWidget.updateSnapshot(SIGNED_OUT_NUTRITION);
    nextWorkoutWidget.updateSnapshot(SIGNED_OUT_NEXT_WORKOUT);
    stepsWidget.updateSnapshot(SIGNED_OUT_STEPS);
  });
  await endWorkoutActivities();
}
