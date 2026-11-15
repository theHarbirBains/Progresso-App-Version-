import type { ReminderSettings } from './reminderSettings';

// The reminders to schedule on the phone for the next week, worked out from what the app
// already knows -- the next split day, when they last trained (and each muscle), today's food
// log and targets. A scheduled notification can't look anything up when it fires, so the plan is
// made again whenever any of that changes (RemindersProvider): a workout finished moves every
// training nudge on, a food logged drops today's meal reminder and redoes the check-in's
// figures. A day ahead has nothing logged yet -- logging means opening the app, which plans
// again -- so its reminders say so. Nutrition's reminders only come with a membership that
// includes it.

/** How many days ahead are scheduled, today included. */
export const PLAN_DAYS = 7;

export type ReminderKind = 'workout' | 'meals' | 'checkIn' | 'weekly';

export interface PlannedReminder {
  /** Unique per kind and day: "progresso-reminder-meals-2026-11-14". */
  id: string;
  kind: ReminderKind;
  at: Date;
  title: string;
  body: string;
  /** Where tapping it opens, as a path in the app's links ("nutrition"). */
  path: string;
}

export interface ReminderContext {
  now: Date;
  /** The next day of their split, or null without one. */
  nextWorkout: { name: string; muscles: string } | null;
  /** When their last finished workout was (ISO), or null before their first. */
  lastWorkoutAt: string | null;
  /** When each muscle they've trained was last trained -- for "haven't trained legs in 9 days". */
  musclesLastTrained: { label: string; at: string }[];
  /** The membership includes Nutrition. */
  nutrition: boolean;
  today: {
    /** Anything at all logged today. */
    logged: boolean;
    calories: number;
    proteinG: number;
    calorieTarget: number | null;
    proteinTarget: number | null;
  };
}

export const REMINDER_ID_PREFIX = 'progresso-reminder-';

/** Training nudges come at 5:00 PM -- no time to set. */
export const NUDGE_TIME = 17 * 60;
/** The first nudge comes this many days after the last workout, then every other day. */
export const NUDGE_AFTER_DAYS = 2;
/** A muscle counts as not trained in a while from this many days. */
export const STALE_MUSCLE_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** Whole days from one date's day to another's. */
function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / MS_PER_DAY);
}

/**
 * The day's training nudge, if it's one: from the second day without a workout, every other day
 * (before their first workout, from tomorrow, every other day). Alternating, where both can be
 * said: what's up next in their split, and the muscle they've gone longest without -- a week or
 * more. With neither, how long it's been.
 */
export function trainingNudge(
  context: ReminderContext,
  day: Date,
): { title: string; body: string } | null {
  const last = context.lastWorkoutAt ? new Date(context.lastWorkoutAt) : null;
  const since = last
    ? daysBetween(last, day)
    : daysBetween(context.now, day) + NUDGE_AFTER_DAYS - 1;
  if (since < NUDGE_AFTER_DAYS || (since - NUDGE_AFTER_DAYS) % 2 !== 0) return null;
  const nudgeIndex = (since - NUDGE_AFTER_DAYS) / 2;

  const stale = context.musclesLastTrained
    .map((muscle) => ({ label: muscle.label, days: daysBetween(new Date(muscle.at), day) }))
    .filter((muscle) => muscle.days >= STALE_MUSCLE_DAYS)
    .sort((a, b) => b.days - a.days)[0];
  const next = context.nextWorkout;
  const lastLine = last
    ? `It's been ${since} days since your last workout.`
    : 'Your first workout is a tap away.';

  const upNext = next
    ? {
        title: `Up next: ${next.name}`,
        body: `${next.muscles ? `${next.muscles}. ` : ''}${lastLine}`,
      }
    : null;
  const muscle = stale
    ? {
        title: `Time for some ${stale.label.toLowerCase()}?`,
        body: `You haven't trained ${stale.label.toLowerCase()} in ${stale.days} days.`,
      }
    : null;
  const first = nudgeIndex % 2 === 0 ? (upNext ?? muscle) : (muscle ?? upNext);
  return first ?? { title: 'Ready when you are', body: `${lastLine} Tap to start one.` };
}

function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function whole(n: number): string {
  return Math.floor(n).toLocaleString();
}

const NOTHING_LOGGED = 'Nothing logged yet today.';

/** The check-in's line: the day so far against the targets. */
export function checkInBody(today: ReminderContext['today']): string {
  if (!today.logged) {
    return `${NOTHING_LOGGED} Log your meals to see where your calories and protein stand.`;
  }
  const { calories, proteinG, calorieTarget, proteinTarget } = today;
  const caloriesPart =
    calorieTarget !== null
      ? `${whole(calories)} of ${whole(calorieTarget)} calories`
      : `${whole(calories)} calories`;
  const proteinPart =
    proteinTarget !== null
      ? `${whole(proteinG)} of ${whole(proteinTarget)} g protein`
      : `${whole(proteinG)} g protein`;
  let line = `${caloriesPart} and ${proteinPart} so far today.`;
  if (proteinTarget !== null) {
    const left = Math.floor(proteinTarget) - Math.floor(proteinG);
    line += left > 0 ? ` ${left.toLocaleString()} g of protein to go.` : ' Protein target reached.';
  }
  return line;
}

export function planReminders(
  settings: ReminderSettings,
  context: ReminderContext,
  days = PLAN_DAYS,
): PlannedReminder[] {
  const { now } = context;
  const plan: PlannedReminder[] = [];
  const add = (
    kind: ReminderKind,
    day: Date,
    time: number,
    rest: Omit<PlannedReminder, 'id' | 'kind' | 'at'>,
  ) => {
    const at = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      Math.floor(time / 60),
      time % 60,
    );
    if (at.getTime() <= now.getTime()) return;
    plan.push({ id: `${REMINDER_ID_PREFIX}${kind}-${dayKey(day)}`, kind, at, ...rest });
  };

  for (let offset = 0; offset < days; offset++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const isToday = offset === 0;

    const nudge = settings.workout.on ? trainingNudge(context, day) : null;
    if (nudge) add('workout', day, NUDGE_TIME, { ...nudge, path: 'workouts/new' });

    if (context.nutrition && settings.meals.on && !(isToday && context.today.logged)) {
      add('meals', day, settings.meals.time, {
        title: 'Log your meals',
        body: `${NOTHING_LOGGED} Log what you've eaten so your daily targets stay on track.`,
        path: 'nutrition',
      });
    }

    if (context.nutrition && settings.checkIn.on) {
      add('checkIn', day, settings.checkIn.time, {
        title: 'Protein & calorie check-in',
        body: checkInBody(
          isToday
            ? context.today
            : { logged: false, calories: 0, proteinG: 0, calorieTarget: null, proteinTarget: null },
        ),
        path: 'nutrition',
      });
    }

    if (settings.weekly.on && day.getDay() === 0) {
      add('weekly', day, settings.weekly.time, {
        title: 'Your week in Progresso',
        body: context.nutrition
          ? 'Your Weekly Summary is ready: workouts, sets, nutrition and your best lifts.'
          : 'Your Weekly Summary is ready: workouts, sets and your best lifts.',
        path: 'progress',
      });
    }
  }
  return plan.sort((a, b) => a.at.getTime() - b.at.getTime());
}
