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

/**
 * What every home-screen widget wears, beside what it shows: the app theme's accent and photo
 * (widgetLook.ts), and the day the entry is for. Each may be missing -- before the app has handed
 * a widget anything, or where the photo couldn't be kept -- and the widget has its own fallback.
 */
export interface WidgetLook {
  /** The theme's accent, "#RRGGBB". */
  accent?: string;
  /** The accent worked into the app's fill, opaque: the widget's own background without a photo. */
  glow?: string;
  /** The theme's photo cut for each size, as file URLs in the App Group, where a widget can read them. */
  photoSmall?: string;
  photoMedium?: string;
  /** The entry's day, "Sun, Nov 1". */
  day?: string;
}

/** The theme's part of the look -- everything but the day. */
const THEME_KEYS = ['accent', 'glow', 'photoSmall', 'photoMedium'] as const;

/** `props` in `look`: its theme replaced outright, so nothing of a theme before stays behind. */
export function withLook<P extends WidgetLook>(props: P, look: WidgetLook): P {
  const dressed = { ...props };
  for (const key of THEME_KEYS) delete dressed[key];
  for (const key of THEME_KEYS) if (look[key] !== undefined) dressed[key] = look[key];
  return dressed;
}

/** Whether `props` already wears `look`'s theme. */
export function wearsLook(props: WidgetLook, look: WidgetLook): boolean {
  return THEME_KEYS.every((key) => props[key] === look[key]);
}

/** One of Today's Nutrition's macros: "92 / 180 g", and how far along it is when it has a target. */
export interface WidgetMacro {
  label: string;
  amount: string;
  /** 0-1; absent when there's no target to measure it against. */
  progress?: number;
}

export interface NutritionWidgetProps extends WidgetLook {
  signedIn: boolean;
  /** The big figure: calories left, over, or eaten when there's no calorie target. */
  calories: string;
  /** "calories left", "calories over" or "calories eaten". */
  caption: string;
  /** Calories eaten against the target, 0-1; absent with no target. */
  progress?: number;
  macros: WidgetMacro[];
}

export interface NextWorkoutWidgetProps extends WidgetLook {
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

export interface StepsWidgetProps extends WidgetLook {
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
  /** The app theme's accent, "#RRGGBB", when the card was started. */
  accent?: string;
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

/** How far along, 0-1, as a prop: `{ progress }`, or nothing at all without a target. */
function share(eaten: number, target: number | null): { progress?: number } {
  if (target === null || target <= 0) return {};
  return { progress: Math.min(1, Math.max(0, eaten / target)) };
}

function macro(label: string, eaten: number, target: number | null): WidgetMacro {
  return {
    label,
    amount:
      target === null
        ? `${wholeFigureText(eaten)} g`
        : `${wholeFigureText(eaten)} / ${wholeFigureText(target)} g`,
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
    calories: wholeFigureText(left === null ? eaten.calories : Math.abs(left)),
    caption:
      left === null ? 'calories eaten' : wholeFigure(left) < 0 ? 'calories over' : 'calories left',
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

/** "Sun, Nov 1": the date at the top of every widget. */
export function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** How many days ahead a widget's date is written: it stays right for a week without the app. */
export const WIDGET_DAYS_AHEAD = 7;

export type WidgetTimeline<P> = { date: Date; props: P }[];

/**
 * A widget's timeline: `today` now, then `later` from each of the next midnights, each entry
 * dated with its own day -- so the date on the widget turns over at midnight by itself.
 */
export function dailyTimeline<P extends WidgetLook>(
  now: Date,
  today: P,
  later: P,
): WidgetTimeline<P> {
  const entries: WidgetTimeline<P> = [{ date: now, props: { ...today, day: dayLabel(now) } }];
  let midnight = now;
  for (let i = 0; i < WIDGET_DAYS_AHEAD; i += 1) {
    midnight = nextMidnight(midnight);
    entries.push({ date: midnight, props: { ...later, day: dayLabel(midnight) } });
  }
  return entries;
}

/** Today's Nutrition now, then a fresh day each midnight -- nothing eaten yet, the targets kept. */
export function nutritionTimeline(
  eaten: NutritionTotals,
  targets: NutritionGoalValues,
  now: Date,
): WidgetTimeline<NutritionWidgetProps> {
  return dailyTimeline(
    now,
    nutritionWidgetProps(eaten, targets),
    nutritionWidgetProps(NOTHING_EATEN, targets),
  );
}

/** "6:42 PM". */
export function clockTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Today's steps now, then, from midnight, a reminder that they need the app to update. */
export function stepsTimeline(steps: number | null, now: Date): WidgetTimeline<StepsWidgetProps> {
  const today: StepsWidgetProps =
    steps === null
      ? { signedIn: true, caption: 'Connect Apple Health in Progresso' }
      : { signedIn: true, steps: wholeFigureText(steps), caption: `As of ${clockTime(now)}` };
  return dailyTimeline(now, today, { signedIn: true, caption: 'Open Progresso to update' });
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
