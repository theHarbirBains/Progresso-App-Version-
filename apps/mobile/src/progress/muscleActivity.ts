import { MUSCLE_GROUPS, type MuscleGroup } from '../exercises/muscleGroups';
import type { ActivityEntry } from './muscleActivityQueries';

// Muscle Activity: which muscle groups the person has trained lately, worked out from the sets
// they logged -- never a recovery figure. Each exercise counts toward its own muscle group (its
// primary one, as everywhere in the app) and, for a built-in, the groups it also works (the
// catalogue's secondary_muscle_groups); the two are kept apart, never weighted into one number.

export const ACTIVITY_PERIODS = [7, 30, 90] as const;
export type ActivityPeriod = (typeof ACTIVITY_PERIODS)[number];

/**
 * How lately a muscle group was trained as the main muscle, in the period (Harbir's heat map,
 * November 2026), by the day it was last trained -- today counted as its first day: within the
 * last 2 days (today or yesterday); 3 to 7 days; 8 to 14 days; or longer ago, or not in the
 * period at all. A muscle an exercise only also works never colours it: that isn't a set of its
 * own.
 */
export const ACTIVITY_LEVELS = ['recent', 'frequent', 'less', 'none'] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  recent: 'Recently trained',
  frequent: 'Frequently trained',
  less: 'Less trained',
  none: 'No recent training',
};

/** The days each level covers, as the legend says them. */
export const ACTIVITY_LEVEL_NOTES: Record<ActivityLevel, string> = {
  recent: '1–2 days',
  frequent: '3–7 days',
  less: '8–14 days',
  none: '15+ days',
};

/** The most days since it was trained (0 today, 1 yesterday) for each level but none. */
const LEVEL_MAX_DAYS = { recent: 1, frequent: 6, less: 13 } as const;

/** Every muscle group drawn on the anatomy figure. */
export const ACTIVITY_GROUPS: readonly MuscleGroup[] = MUSCLE_GROUPS.filter(
  (group) => group !== 'full_body' && group !== 'other',
);

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

/** Whole days from a moment's day to today's: 0 today, 1 yesterday. */
export function daysSince(at: string, now: Date): number {
  return Math.round((startOfDay(now).getTime() - startOfDay(new Date(at)).getTime()) / DAY_MS);
}

/** A group's level from when it was last trained as the main muscle in the period, if it was. */
export function levelFor(lastTrainedAt: string | null, now: Date): ActivityLevel {
  if (lastTrainedAt === null) return 'none';
  const days = daysSince(lastTrainedAt, now);
  if (days <= LEVEL_MAX_DAYS.recent) return 'recent';
  if (days <= LEVEL_MAX_DAYS.frequent) return 'frequent';
  if (days <= LEVEL_MAX_DAYS.less) return 'less';
  return 'none';
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
    const level = levelFor(lastTrainedAt, now);
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

/** How many groups were trained as the main muscle in the period. */
export function musclesTrained(activity: readonly GroupActivity[]): number {
  return activity.filter((group) => group.sets > 0).length;
}

/** A group's sessions against the most any group had in the period: 0 to 1. */
export function sessionShare(group: GroupActivity, activity: readonly GroupActivity[]): number {
  const most = Math.max(0, ...activity.map((other) => other.sessions));
  return most === 0 ? 0 : group.sessions / most;
}

/** How Muscle Breakdown is ordered. */
export const BREAKDOWN_SORTS = ['recent', 'most', 'least'] as const;
export type BreakdownSort = (typeof BREAKDOWN_SORTS)[number];

export const BREAKDOWN_SORT_LABELS: Record<BreakdownSort, string> = {
  recent: 'Recent',
  most: 'Most Trained',
  least: 'Least Trained',
};

/**
 * Muscle Breakdown's order: Recent -- last trained first, then the ones not trained in the
 * period; Most Trained -- most sessions, then most sets; Least Trained -- fewest sessions, then
 * fewest sets (a pointer, never a verdict). Ties keep the app's order of muscle groups.
 */
export function sortBreakdown(
  activity: readonly GroupActivity[],
  sort: BreakdownSort,
): GroupActivity[] {
  const order = new Map(activity.map((group, index) => [group.group, index]));
  const appOrder = (a: GroupActivity, b: GroupActivity) =>
    order.get(a.group)! - order.get(b.group)!;
  const when = (group: GroupActivity) =>
    group.lastTrainedAt ? new Date(group.lastTrainedAt).getTime() : -Infinity;
  return [...activity].sort((a, b) => {
    if (sort === 'recent') return when(b) - when(a) || appOrder(a, b);
    if (sort === 'most') return b.sessions - a.sessions || b.sets - a.sets || appOrder(a, b);
    return a.sessions - b.sessions || a.sets - b.sets || appOrder(a, b);
  });
}

/** "Today", "Yesterday", "3 days ago", or the date for longer ago. */
export function sinceText(at: string | null, now: Date): string | null {
  if (!at) return null;
  const days = daysSince(at, now);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
