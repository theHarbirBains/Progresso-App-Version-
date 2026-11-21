import {
  CARDIO_INFO,
  averageSpeedKmh,
  type CardioActivity,
  type CardioRate,
  type CardioValues,
} from '../cardio/cardioActivities';
import { weekRange } from './weeklySummary';

// What Progress's Cardio tab shows, worked out from the cardio actually saved in the person's
// finished workouts (cardio/cardioQueries.ts's fetchCardioHistory) -- never estimated, and never
// mixed with lifting: no volume, sets or exercises here. A figure only counts the activities that
// have it: an average pace is over the runs with a distance (or a pace typed), floors over the
// climbs that counted them. Pure, so it's tested on its own.

/** A cardio activity with when its workout was. */
export type CardioRecord = CardioValues & { id: string; workoutId: string; performedAt: string };

export type CardioRange = 'week' | 'month' | 'quarter' | 'all';

/** Each range's days, up to and including today -- every day there is, for All Time. */
export const CARDIO_RANGES: { label: string; value: CardioRange; days: number | null }[] = [
  { label: 'Week', value: 'week', days: 7 },
  { label: 'Month', value: 'month', days: 30 },
  { label: '3 Months', value: 'quarter', days: 90 },
  { label: 'All Time', value: 'all', days: null },
];

/** The activities in a range: its last days, today included, or all of them. */
export function inRange<T extends { performedAt: string }>(
  records: T[],
  range: CardioRange,
  now: Date,
): T[] {
  const days = CARDIO_RANGES.find((r) => r.value === range)?.days ?? null;
  if (days === null) return records;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  return records.filter((record) => {
    const at = Date.parse(record.performedAt);
    return at >= start && at < end;
  });
}

export interface CardioTotals {
  sessions: number;
  seconds: number;
  /** Over the activities with a distance. */
  distanceM: number;
  /** How many had a distance. */
  withDistance: number;
}

export function totalsOf(records: CardioValues[]): CardioTotals {
  let seconds = 0;
  let distanceM = 0;
  let withDistance = 0;
  for (const record of records) {
    seconds += record.durationSeconds;
    if (record.distanceM !== null && record.distanceM !== undefined) {
      distanceM += record.distanceM;
      withDistance += 1;
    }
  }
  return { sessions: records.length, seconds, distanceM, withDistance };
}

export interface ActivityShare extends CardioTotals {
  activity: CardioActivity;
}

/** Each activity's totals, the most time first. */
export function byActivity(records: CardioValues[]): ActivityShare[] {
  const groups = new Map<CardioActivity, CardioValues[]>();
  for (const record of records) {
    groups.set(record.activity, [...(groups.get(record.activity) ?? []), record]);
  }
  return [...groups.entries()]
    .map(([activity, group]) => ({ activity, ...totalsOf(group) }))
    .sort((a, b) => b.seconds - a.seconds || b.sessions - a.sessions);
}

/** The activities the person has done, the most sessions first -- the tab's activity choices. */
export function activitiesDone(records: CardioValues[]): CardioActivity[] {
  return byActivity(records)
    .sort((a, b) => b.sessions - a.sessions || b.seconds - a.seconds)
    .map((share) => share.activity);
}

/** A time-weighted average of a figure over the activities that have it; null with none. */
function weighted(
  records: CardioValues[],
  figure: (record: CardioValues) => number | null | undefined,
): number | null {
  let sum = 0;
  let seconds = 0;
  for (const record of records) {
    const value = figure(record);
    if (value === null || value === undefined) continue;
    sum += value * record.durationSeconds;
    seconds += record.durationSeconds;
  }
  return seconds > 0 ? sum / seconds : null;
}

function total(
  records: CardioValues[],
  figure: (record: CardioValues) => number | null | undefined,
): number | null {
  let sum = 0;
  let any = false;
  for (const record of records) {
    const value = figure(record);
    if (value === null || value === undefined) continue;
    sum += value;
    any = true;
  }
  return any ? sum : null;
}

/** One activity's figures over a range -- each null where none of its sessions recorded it. */
export interface ActivityFigures {
  /** Time-weighted: the distance over the time, for sessions told by distance. */
  averageSpeedKmh: number | null;
  averageSeconds: number | null;
  /** Over the sessions with a distance. */
  averageDistanceM: number | null;
  averageIncline: number | null;
  averageLevel: number | null;
  averageSpeedSetting: number | null;
  averageStrokeRate: number | null;
  floors: number | null;
  steps: number | null;
  laps: number | null;
}

export function figuresOf(records: CardioValues[]): ActivityFigures {
  const totals = totalsOf(records);
  return {
    averageSpeedKmh: weighted(records, averageSpeedKmh),
    averageSeconds: records.length > 0 ? totals.seconds / records.length : null,
    averageDistanceM: totals.withDistance > 0 ? totals.distanceM / totals.withDistance : null,
    averageIncline: weighted(records, (r) => r.inclinePercent),
    averageLevel: weighted(records, (r) => r.resistanceLevel),
    averageSpeedSetting: weighted(records, (r) => r.speedSetting),
    averageStrokeRate: weighted(records, (r) => r.strokeRate),
    floors: total(records, (r) => r.floors),
    steps: total(records, (r) => r.steps),
    laps: total(records, (r) => r.laps),
  };
}

/** One activity's bests: its longest session, its farthest, and its fastest (by its rate). */
export interface ActivityBests<T> {
  longest: T | null;
  farthest: T | null;
  fastest: { record: T; speedKmh: number } | null;
}

export function bestsOf<T extends CardioValues>(records: T[]): ActivityBests<T> {
  let longest: T | null = null;
  let farthest: T | null = null;
  let fastest: { record: T; speedKmh: number } | null = null;
  for (const record of records) {
    if (!longest || record.durationSeconds > longest.durationSeconds) longest = record;
    const distance = record.distanceM ?? null;
    if (distance !== null && (!farthest || distance > (farthest.distanceM ?? 0))) {
      farthest = record;
    }
    const speed = averageSpeedKmh(record);
    if (speed !== null && (!fastest || speed > fastest.speedKmh)) {
      fastest = { record, speedKmh: speed };
    }
  }
  return { longest, farthest, fastest };
}

/** How an activity's speed reads, or none for one that isn't told by one. */
export function rateOf(activity: CardioActivity): CardioRate | null {
  return CARDIO_INFO[activity].rate;
}

export type TrendPeriod = 'weekly' | 'monthly';

/** How many weeks or months the trend lists, this one included. */
export const TREND_LENGTH: Record<TrendPeriod, number> = { weekly: 8, monthly: 6 };

export interface TrendBucket extends CardioTotals {
  start: Date;
  end: Date;
  /** The week or month today falls in. */
  current: boolean;
  /** Time-weighted, over the sessions with one; null with none. */
  speedKmh: number | null;
}

/**
 * The last weeks (Monday to Sunday, like the Weekly Summary) or calendar months, the current one
 * first, each with its sessions, time, distance and average speed. A week with nothing is a 0,
 * never skipped.
 */
export function trendOf<T extends CardioValues & { performedAt: string }>(
  records: T[],
  period: TrendPeriod,
  now: Date,
): TrendBucket[] {
  const buckets = Array.from({ length: TREND_LENGTH[period] }, (_, ago) => {
    if (period === 'weekly') return { ...weekRange(now, ago), current: ago === 0 };
    const start = new Date(now.getFullYear(), now.getMonth() - ago, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - ago + 1, 1);
    return { start, end, current: ago === 0 };
  });
  return buckets.map(({ start, end, current }) => {
    const inside = records.filter((record) => {
      const at = Date.parse(record.performedAt);
      return at >= start.getTime() && at < end.getTime();
    });
    return {
      start,
      end,
      current,
      ...totalsOf(inside),
      speedKmh: weighted(inside, averageSpeedKmh),
    };
  });
}
