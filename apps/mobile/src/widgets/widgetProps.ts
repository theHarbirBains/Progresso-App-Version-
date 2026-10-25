import type { NutritionGoalValues, NutritionTotals } from '../nutrition/nutritionCalculations';
import { wholeFigure, wholeFigureText } from '../nutrition/wholeFigures';

// What the home-screen widgets and the Lock Screen workout card are shown. A widget runs in its
// own little runtime outside the app (expo-widgets), sees only these props, and can't import
// anything -- so every figure arrives here already worded and rounded, and the widget just lays
// it out. Built in the app from what it already has; nothing here is fetched for a widget alone.
//
// No prop is ever null: expo-widgets keeps a widget's props in iOS's shared UserDefaults, which
// only holds property-list values, and a null there (it arrives as NSNull) raises an exception
// that kills the app outright -- builds 28 and 29 did exactly that. Something that isn't known is
// left out instead, and plistSafe strips anything else unsafe on the way out.

/** One of Today's Nutrition's macros: "92 / 180 g", and how far along it is when it has a target. */
export interface WidgetMacro {
  label: string;
  amount: string;
  /** 0-1; absent when there's no target to measure it against. */
  progress?: number;
}

export interface NutritionWidgetProps {
  signedIn: boolean;
  /** The big figure: calories left, over, or eaten when there's no calorie target. */
  calories: string;
  /** "cal left", "cal over" or "cal eaten". */
  caption: string;
  /** Calories eaten against the target, 0-1; absent with no target. */
  progress?: number;
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
  /** Today's steps; absent when they aren't known for the day shown. */
  steps?: string;
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

export const SIGNED_OUT_STEPS: StepsWidgetProps = { signedIn: false, caption: '' };

const NOTHING_EATEN: NutritionTotals = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };

function whole(value: number): string {
  return wholeFigureText(value);
}

/** How far along, 0-1, as a prop: `{ progress }`, or nothing at all without a target. */
function share(eaten: number, target: number | null): { progress?: number } {
  if (target === null || target <= 0) return {};
  return { progress: Math.min(1, Math.max(0, eaten / target)) };
}

function macro(label: string, eaten: number, target: number | null): WidgetMacro {
  return {
    label,
    amount: target === null ? `${whole(eaten)} g` : `${whole(eaten)} / ${whole(target)} g`,
    ...share(eaten, target),
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
    caption: left === null ? 'cal eaten' : wholeFigure(left) < 0 ? 'cal over' : 'cal left',
    ...share(eaten.calories, targets.calories),
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
      ? { signedIn: true, caption: 'Connect Apple Health in Progresso' }
      : { signedIn: true, steps: whole(steps), caption: `As of ${clockTime(now)}` };
  return [
    { date: now, props: today },
    { date: nextMidnight(now), props: { signedIn: true, caption: 'Open Progresso to update' } },
  ];
}

/**
 * Props made safe for iOS's UserDefaults, where expo-widgets keeps them: null and undefined
 * values and non-finite numbers are left out of plain objects and arrays alike (a null there
 * would crash the app -- see the top of this file). Strings, finite numbers, booleans, arrays and
 * plain objects pass through; anything else (a Date) is left as it is.
 */
export function plistSafe<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter(isKept).map((item) => plistSafe(item)) as T;
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    const kept: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (isKept(item)) kept[key] = plistSafe(item);
    }
    return kept as T;
  }
  return value;
}

/** A timeline with each entry's props made safe; its dates are left as they are. */
export function plistSafeTimeline<P>(
  entries: { date: Date; props: P }[],
): { date: Date; props: P }[] {
  return entries.map((entry) => ({ date: entry.date, props: plistSafe(entry.props) }));
}

function isKept(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  return true;
}
