import { MUSCLE_GROUPS, type MuscleGroup } from '../exercises/muscleGroups';
import type { ActivityEntry } from './muscleActivityQueries';

// Muscle Activity: which muscle groups the person has trained lately, worked out from the sets
// they logged -- never a recovery figure. Each exercise counts toward its own muscle group (its
// primary one, as everywhere in the app) and, for a built-in, the groups it also works (the
// catalogue's secondary_muscle_groups); the two are kept apart, never weighted into one number.

export const ACTIVITY_PERIODS = [7, 30, 90] as const;
export type ActivityPeriod = (typeof ACTIVITY_PERIODS)[number];

/**
 * How a muscle group has been trained in the period, in order: trained as the main muscle today
 * or yesterday; on average at least twice a week; at all (or only as a muscle it also works); or
 * not at all.
 */
export const ACTIVITY_LEVELS = ['recent', 'frequent', 'less', 'none'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  recent: 'Recently trained',
  frequent: 'Frequently trained',
  less: 'Less trained',
  none: 'No recent training',
};

/** What each level means, in a line. */
export const ACTIVITY_LEVEL_NOTES: Record<ActivityLevel, string> = {
  recent: 'Trained today or yesterday',
  frequent: 'Twice a week or more, on average',
  less: 'Trained less often, or only as a muscle it also works',
  none: 'Nothing logged in this period',
};

/** Sessions a week, on average, for a group to count as frequently trained. */
export const FREQUENT_PER_WEEK = 2;

/** Every muscle group drawn on the anatomy figure. */
export const ACTIVITY_GROUPS: readonly MuscleGroup[] = MUSCLE_GROUPS.filter(
  (group) => group !== 'full_body' && group !== 'other',
);

/** The groups a training week is usually built around -- the ones checked for less training. */
export const MAIN_GROUPS: readonly MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'core',
];

export interface ActivityExercise {
  exerciseId: string;
  name: string;
  /** Working sets of it in the period. */
  sets: number;
  lastDoneAt: string;
  /** Whether this group is the exercise's own (else one it also works). */
  primary: boolean;
}

export interface TrendBucket {
  /** The bucket's first day, at local midnight. */
  start: Date;
  /** Working sets with this group as the main muscle. */
  sets: number;
}

export interface GroupActivity {
  group: MuscleGroup;
  level: ActivityLevel;
  /** Working sets (never a warm-up or a drop) with this as the exercise's own muscle group. */
  sets: number;
  /** Working sets of exercises that also work it. */
  secondarySets: number;
  /** Workouts that trained it as the main muscle. */
  sessions: number;
  /** Workouts that worked it only as a muscle the exercise also works. */
  secondarySessions: number;
  /** `sessions` a week, on average over the period. */
  perWeek: number;
  /** Weight x reps of its weighted sets as the main muscle (drops included), kg. */
  volumeKg: number;
  /** When it was last trained as the main muscle; null if not in the period. */
  lastTrainedAt: string | null;
  /** When it was last worked at all, main or also-worked. */
  lastWorkedAt: string | null;
  /** The exercises behind it, main ones first, each newest first. */
  exercises: ActivityExercise[];
  trend: TrendBucket[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** The period's first day, at local midnight: today and the days before it, `period` in all. */
export function periodStart(period: ActivityPeriod, now: Date): Date {
  return addDays(startOfDay(now), -(period - 1));
}

/**
 * The trend's buckets, oldest first: each day for a week; for longer, each seven days counted back
 * from today (the oldest may be shorter, starting with the period).
 */
export function trendBuckets(period: ActivityPeriod, now: Date): Date[] {
  const first = periodStart(period, now);
  if (period === 7) return Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const today = startOfDay(now);
  const starts: Date[] = [];
  for (let start = addDays(today, -6); start > first; start = addDays(start, -7)) {
    starts.unshift(start);
  }
  starts.unshift(first);
  return starts;
}

function bucketOf(starts: readonly Date[], at: Date): number {
  for (let i = starts.length - 1; i >= 0; i -= 1) {
    if (at >= starts[i]!) return i;
  }
  return -1;
}

/** Whether a day is today or yesterday. */
function withinTwoDays(at: string, now: Date): boolean {
  return new Date(at).getTime() >= addDays(startOfDay(now), -1).getTime();
}

/**
 * Each muscle group's activity in the period, from what was logged: `entries` are the exercises
 * done in finished workouts (fetchMuscleActivity), `secondaryOf` the groups a built-in also works.
 * Every group on the figure is in the answer, in the app's order, trained or not.
 */
export function muscleActivity(
  entries: readonly ActivityEntry[],
  period: ActivityPeriod,
  now: Date,
  secondaryOf: (exerciseId: string) => readonly MuscleGroup[],
): GroupActivity[] {
  const from = periodStart(period, now);
  const starts = trendBuckets(period, now);
  const weeks = period / 7;

  interface Tally {
    sets: number;
    secondarySets: number;
    sessions: Set<string>;
    secondarySessions: Set<string>;
    volumeKg: number;
    lastTrainedAt: string | null;
    lastWorkedAt: string | null;
    exercises: Map<string, ActivityExercise>;
    trend: number[];
  }
  const tallies = new Map<MuscleGroup, Tally>();
  const tallyOf = (group: MuscleGroup): Tally => {
    let tally = tallies.get(group);
    if (!tally) {
      tally = {
        sets: 0,
        secondarySets: 0,
        sessions: new Set(),
        secondarySessions: new Set(),
        volumeKg: 0,
        lastTrainedAt: null,
        lastWorkedAt: null,
        exercises: new Map(),
        trend: starts.map(() => 0),
      };
      tallies.set(group, tally);
    }
    return tally;
  };
  const later = (a: string | null, b: string) =>
    a === null || new Date(b).getTime() > new Date(a).getTime() ? b : a;

  for (const entry of entries) {
    const at = new Date(entry.performedAt);
    if (at < from || at.getTime() > now.getTime() + DAY_MS) continue;
    const working = entry.sets.filter((set) => !set.isDrop).length;
    if (working === 0) continue;
    const volume =
      entry.measurementType === 'weight_reps'
        ? entry.sets.reduce((sum, set) => sum + (set.weightKg ?? 0) * (set.reps ?? 0), 0)
        : 0;

    const own = tallyOf(entry.muscleGroup);
    own.sets += working;
    own.sessions.add(entry.workoutId);
    own.volumeKg += volume;
    own.lastTrainedAt = later(own.lastTrainedAt, entry.performedAt);
    own.lastWorkedAt = later(own.lastWorkedAt, entry.performedAt);
    const bucket = bucketOf(starts, at);
    if (bucket >= 0) own.trend[bucket]! += working;
    note(own, entry, working, true);

    for (const group of new Set(secondaryOf(entry.exerciseId))) {
      if (group === entry.muscleGroup) continue;
      const also = tallyOf(group);
      also.secondarySets += working;
      also.secondarySessions.add(entry.workoutId);
      also.lastWorkedAt = later(also.lastWorkedAt, entry.performedAt);
      note(also, entry, working, false);
    }
  }

  function note(tally: Tally, entry: ActivityEntry, sets: number, primary: boolean) {
    const known = tally.exercises.get(entry.exerciseId);
    if (known) {
      known.sets += sets;
      known.lastDoneAt = later(known.lastDoneAt, entry.performedAt) as string;
    } else {
      tally.exercises.set(entry.exerciseId, {
        exerciseId: entry.exerciseId,
        name: entry.exerciseName,
        sets,
        lastDoneAt: entry.performedAt,
        primary,
      });
    }
  }

  return ACTIVITY_GROUPS.map((group): GroupActivity => {
    const tally = tallies.get(group);
    const sessions = tally?.sessions.size ?? 0;
    // A workout that trained it as the main muscle isn't counted again as also-worked.
    const secondarySessions = tally
      ? [...tally.secondarySessions].filter((id) => !tally.sessions.has(id)).length
      : 0;
    const perWeek = sessions / weeks;
    const lastTrainedAt = tally?.lastTrainedAt ?? null;
    const level: ActivityLevel =
      lastTrainedAt !== null && withinTwoDays(lastTrainedAt, now)
        ? 'recent'
        : perWeek >= FREQUENT_PER_WEEK
          ? 'frequent'
          : sessions > 0 || (tally?.secondarySets ?? 0) > 0
            ? 'less'
            : 'none';
    return {
      group,
      level,
      sets: tally?.sets ?? 0,
      secondarySets: tally?.secondarySets ?? 0,
      sessions,
      secondarySessions,
      perWeek,
      volumeKg: tally?.volumeKg ?? 0,
      lastTrainedAt,
      lastWorkedAt: tally?.lastWorkedAt ?? null,
      exercises: tally
        ? [...tally.exercises.values()].sort(
            (a, b) =>
              Number(b.primary) - Number(a.primary) ||
              new Date(b.lastDoneAt).getTime() - new Date(a.lastDoneAt).getTime(),
          )
        : [],
      trend: starts.map((start, i) => ({ start, sets: tally?.trend[i] ?? 0 })),
    };
  });
}

/**
 * The main groups trained least in the period -- less trained or not at all -- fewest sets as the
 * main muscle first (then fewest also-worked sets). What the page suggests a look at, never a
 * verdict.
 */
export function lessTrained(activity: readonly GroupActivity[]): GroupActivity[] {
  return activity
    .filter(
      (group) =>
        MAIN_GROUPS.includes(group.group) && (group.level === 'less' || group.level === 'none'),
    )
    .sort((a, b) => a.sets - b.sets || a.secondarySets - b.secondarySets);
}

/** "Today", "Yesterday", "3 days ago", or the date for longer ago. */
export function sinceText(at: string | null, now: Date): string | null {
  if (!at) return null;
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(new Date(at)).getTime()) / DAY_MS,
  );
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
