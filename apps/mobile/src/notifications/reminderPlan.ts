import type { ReminderSettings } from './reminderSettings';

// The reminders to schedule on the phone for the next week, worked out from what the app
// already knows -- the next split day, whether a workout was finished today, today's food log
// and targets. A scheduled notification can't look anything up when it fires, so the plan is
// made again whenever any of that changes (RemindersProvider): a workout finished today drops
// today's workout reminder, a food logged drops today's meal reminder and redoes the check-in's
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
  /** A workout was finished today: no more workout reminder today. */
  workedOutToday: boolean;
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

    if (
      settings.workout.on &&
      settings.workout.days.includes(day.getDay()) &&
      !(isToday && context.workedOutToday)
    ) {
      const next = context.nextWorkout;
      add('workout', day, settings.workout.time, {
        title: next ? `${next.name} today` : 'Workout day',
        body: next
          ? `${next.muscles ? `${next.muscles}. ` : ''}Tap to start when you're ready.`
          : "Time to train. Tap to start when you're ready.",
        path: 'workouts/new',
      });
    }

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
