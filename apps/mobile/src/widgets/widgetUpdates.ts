import { recordQuietFailure } from '../lib/sentry';
import type { NutritionGoalValues, NutritionTotals } from '../nutrition/nutritionCalculations';
import type { AppTheme } from '../theme/appThemes';
import { SPLIT_MUSCLE_GROUP_LABELS } from '../workouts/splitMuscleGroups';
import type { NextWorkoutPlan } from '../workouts/nextWorkout';
import type { HomeWidget, HomeWidgets } from './homeWidgetsTypes';
import { withWidgets } from './loadWidgets';
import { setWidgetLook, themeLook, widgetLook } from './widgetLook';
import { keepWidgetPhotos } from './widgetPhotos';
import {
  clockTime,
  dailyTimeline,
  nutritionTimeline,
  plistSafeTimeline,
  SIGNED_OUT_NEXT_WORKOUT,
  SIGNED_OUT_NUTRITION,
  SIGNED_OUT_STEPS,
  stepsTimeline,
  wearsLook,
  withLook,
  type NextWorkoutWidgetProps,
  type WidgetLook,
  type WidgetTimeline,
} from './widgetProps';
import { endWorkoutActivities } from './workoutActivity';

// What the home-screen widgets show, handed over by the app whenever it learns something new:
// today's food log or targets change (WidgetSync), Feed finds the next or open workout, the live
// workout opens or ends, Feed reads today's steps, the app's theme changes. A widget can't fetch
// for itself, so it shows what it was last handed until the app hands it something newer -- each
// time a week of days, so the date at its top turns over at midnight on its own. Everything is
// handed over in the order it's asked for, one at a time: a change of theme reads what a widget
// has and dresses it again, and nothing handed over meanwhile can be lost under it. Updating a
// widget never gets in the way of what the person is doing (loadWidgets.ts): the returned promise
// never rejects.

let queue: Promise<void> = Promise.resolve();

function inTurn(area: string, run: (loaded: HomeWidgets) => unknown): Promise<void> {
  const next = queue.then(() => withWidgets(area, run));
  queue = next;
  return next;
}

/** A timeline in the widgets' look, made safe for iOS to keep. */
function dressed<P extends WidgetLook>(entries: WidgetTimeline<P>): WidgetTimeline<P> {
  const look = widgetLook();
  return plistSafeTimeline(
    entries.map(({ date, props }) => ({ date, props: withLook(props, look) })),
  );
}

/** Today's Nutrition: what's been eaten against the daily targets, and a fresh day from midnight. */
export function showNutritionWidget(
  eaten: NutritionTotals,
  targets: NutritionGoalValues,
  now = new Date(),
): Promise<void> {
  return inTurn('nutrition', ({ nutritionWidget }) =>
    nutritionWidget.updateTimeline(dressed(nutritionTimeline(eaten, targets, now))),
  );
}

/** Today's Steps: the count just read from Apple Health, or null without access. */
export function showStepsWidget(steps: number | null, now = new Date()): Promise<void> {
  return inTurn('steps', ({ stepsWidget }) =>
    stepsWidget.updateTimeline(dressed(stepsTimeline(steps, now))),
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

/** Next Workout: the workout going, or the split's next day -- the same each day until it changes. */
export function showNextWorkoutWidget(
  open: OpenWorkout | null,
  plan: NextWorkoutPlan | null,
  now = new Date(),
): Promise<void> {
  const props = nextWorkoutProps(open, plan);
  return inTurn('nextWorkout', ({ nextWorkoutWidget }) =>
    nextWorkoutWidget.updateTimeline(dressed(dailyTimeline(now, props, props))),
  );
}

/**
 * Dresses the widgets in the app's theme: its photo kept where they can read it, then everything
 * they're showing redone in it (and the Lock Screen card's next start). Nothing is redone when a
 * widget already wears it, as on most launches.
 */
export function applyWidgetTheme(theme: AppTheme): Promise<void> {
  return inTurn('theme', async (widgets) => {
    const look = themeLook(theme);
    try {
      Object.assign(look, await keepWidgetPhotos(theme.id));
    } catch (error) {
      // Without its photo the theme still shows, on its glow.
      recordQuietFailure('widget.photo', error);
    }
    setWidgetLook(look);
    await redress(widgets.nutritionWidget);
    await redress(widgets.nextWorkoutWidget);
    await redress(widgets.stepsWidget);
  });
}

/** What `widget` is showing, redone in the widgets' look, unless it already wears it. */
async function redress<P extends WidgetLook>(widget: HomeWidget<P>): Promise<void> {
  const look = widgetLook();
  const entries = await widget.getTimeline();
  if (entries.every(({ props }) => wearsLook(props, look))) return;
  widget.updateTimeline(dressed(entries));
}

/** Signed out: no one's figures stay on the home screen, and no workout card on the Lock Screen. */
export async function clearWidgets(now = new Date()): Promise<void> {
  await inTurn('signOut', ({ nutritionWidget, nextWorkoutWidget, stepsWidget }) => {
    nutritionWidget.updateTimeline(
      dressed(dailyTimeline(now, SIGNED_OUT_NUTRITION, SIGNED_OUT_NUTRITION)),
    );
    nextWorkoutWidget.updateTimeline(
      dressed(dailyTimeline(now, SIGNED_OUT_NEXT_WORKOUT, SIGNED_OUT_NEXT_WORKOUT)),
    );
    stepsWidget.updateTimeline(dressed(dailyTimeline(now, SIGNED_OUT_STEPS, SIGNED_OUT_STEPS)));
  });
  await endWorkoutActivities();
}
