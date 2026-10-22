import type { NutritionGoalValues, NutritionTotals } from '../nutrition/nutritionCalculations';

// What the home-screen widgets and the Lock Screen workout card are shown. A widget runs in its
// own little runtime outside the app (expo-widgets), sees only these props, and can't import
// anything -- so every figure arrives here already worded and rounded, and the widget just lays
// it out. Built in the app from what it already has; nothing here is fetched for a widget alone.

/** One of Today's Nutrition's macros: "92 / 180 g", and how far along it is when it has a target. */
export interface WidgetMacro {
  label: string;
  amount: string;
  /** 0-1, or null when there's no target to measure it against. */
  progress: number | null;
}

export interface NutritionWidgetProps {
  signedIn: boolean;
  /** The big figure: calories left, over, or eaten when there's no calorie target. */
  calories: string;
  /** "cal left", "cal over" or "cal eaten". */
  caption: string;
  /** Calories eaten against the target, 0-1, or null with no target. */
  progress: number | null;
  macros: WidgetMacro[];
}

export interface NextWorkoutWidgetProps {
  signedIn: boolean;
  /** "Next Workout" or "Workout in Progress". */
  eyebrow: string;
  title: string;
  /** The muscles, "Up next after Pull", or "Your workout · started 6:42 PM". */
  detail: string;
  /** "Start", "Resume" or "Open". */
  action: string;
  /** Where a tap opens the app. */
  url: string;
}

export interface StepsWidgetProps {
  signedIn: boolean;
  /** Today's steps, or null when they aren't known for the day shown. */
  steps: string | null;
  /** "As of 3:42 PM", or what to do to see them. */
  caption: string;
}

/** The Lock Screen card while a workout is going. */
export interface WorkoutActivityProps {
  title: string;
  /** "Your workout" or "Group workout". */
  kind: string;
  /** When it started, in ms: the card counts up from it on its own. */
  startedAt: number;
}

export const SIGNED_OUT_NUTRITION: NutritionWidgetProps = {
  signedIn: false,
  calories: '',
  caption: '',
  progress: null,
  macros: [],
};

export const SIGNED_OUT_NEXT_WORKOUT: NextWorkoutWidgetProps = {
  signedIn: false,
  eyebrow: '',
  title: '',
  detail: '',
  action: '',
  url: 'progresso://feed',
};

export const SIGNED_OUT_STEPS: StepsWidgetProps = { signedIn: false, steps: null, caption: '' };

const NOTHING_EATEN: NutritionTotals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

function whole(value: number): string {
  return Math.round(value).toLocaleString();
}

function share(eaten: number, target: number | null): number | null {
  if (target === null || target <= 0) return null;
  return Math.min(1, Math.max(0, eaten / target));
}

function macro(label: string, eaten: number, target: number | null): WidgetMacro {
  return {
    label,
    amount: target === null ? `${whole(eaten)} g` : `${whole(eaten)} / ${whole(target)} g`,
    progress: share(eaten, target),
  };
}

/** Today's Nutrition for what's been eaten, against the daily targets (the same ones Nutrition uses). */
export function nutritionWidgetProps(
  eaten: NutritionTotals,
  targets: NutritionGoalValues,
): NutritionWidgetProps {
  const left = targets.calories === null ? null : targets.calories - eaten.calories;
  return {
    signedIn: true,
    calories: whole(left === null ? eaten.calories : Math.abs(left)),
    caption: left === null ? 'cal eaten' : Math.round(left) < 0 ? 'cal over' : 'cal left',
    progress: share(eaten.calories, targets.calories),
    macros: [
      macro('Protein', eaten.proteinG, targets.proteinG),
      macro('Carbs', eaten.carbsG, targets.carbsG),
      macro('Fat', eaten.fatG, targets.fatG),
    ],
  };
}

/** The start of the next day: a widget turns over to a fresh day on its own then. */
export function nextMidnight(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
}

/** Today's Nutrition now, then a fresh day at midnight -- nothing eaten yet, the targets kept. */
export function nutritionTimeline(
  eaten: NutritionTotals,
  targets: NutritionGoalValues,
  now: Date,
): { date: Date; props: NutritionWidgetProps }[] {
  return [
    { date: now, props: nutritionWidgetProps(eaten, targets) },
    { date: nextMidnight(now), props: nutritionWidgetProps(NOTHING_EATEN, targets) },
  ];
}

/** "6:42 PM". */
export function clockTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Today's steps now, then, from midnight, a reminder that they need the app to update. */
export function stepsTimeline(
  steps: number | null,
  now: Date,
): { date: Date; props: StepsWidgetProps }[] {
  const today: StepsWidgetProps =
    steps === null
      ? { signedIn: true, steps: null, caption: 'Connect Apple Health in Progresso' }
      : { signedIn: true, steps: whole(steps), caption: `As of ${clockTime(now)}` };
  return [
    { date: now, props: today },
    {
      date: nextMidnight(now),
      props: { signedIn: true, steps: null, caption: 'Open Progresso to update' },
    },
  ];
}
