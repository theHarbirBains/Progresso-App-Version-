import type { HistoricalSet } from '../workouts/exerciseHistoryQueries';
import {
  filterByTimeRange,
  summarizeProgress,
  topSetProgressionDetailed,
  type DetailedChartPoint,
  type ProgressSummary,
  type TimeRange,
} from '../workouts/exerciseProgress';
import { TOP_SET_MIN_REPS } from './topSets';

// Builds on the exact same data/derivations every other Progress page
// already uses (topSetProgressionDetailed, summarizeProgress,
// filterByTimeRange -- all workouts/exerciseProgress.ts) -- nothing here
// fetches or invents a new data source.

export type ProgressLevel = 'significant' | 'progressing' | 'none';

export interface StrengthProgress {
  level: ProgressLevel;
  /** Qualifying, time-range-filtered chart points (see below), chronological ascending. */
  points: DetailedChartPoint[];
  /** Null when there are fewer than 2 qualifying points -- nothing to compare yet. */
  summary: ProgressSummary | null;
}

// A "sustained" trend needs more than a single before/after comparison --
// several real workouts showing the same direction, not one lucky session.
const SUSTAINED_SESSION_COUNT = 4;
// A "clear" (not marginal) relative gain. Percent, not an absolute weight
// delta, since a fixed lb/kg threshold means something different for a
// 45 lb exercise than a 405 lb one -- percent is the same idea in either
// unit and at any starting weight.
const SIGNIFICANT_PERCENT = 15;

export const PROGRESS_LEVEL_LABELS: Record<Exclude<ProgressLevel, 'none'>, string> = {
  significant: 'Significant Progress',
  progressing: 'Progressing',
};

/**
 * One exercise's strength progression over `range`, restricted to sets of
 * at least TOP_SET_MIN_REPS reps -- the same qualifying threshold Top Sets
 * already uses (topSets.ts) -- so a single heavy low-rep attempt never
 * reads as a "weight increase" against a higher-rep working set; every
 * point being compared is a genuinely comparable working set.
 *
 * Never treats every improvement as significant (see the product's own
 * "200x8 -> 200x9 shouldn't be a milestone" example): a real gain only
 * counts as "significant" once it's both sustained across multiple real
 * workouts AND a clear (not marginal) relative improvement. Anything
 * smaller but still a genuine, real gain is "progressing"; no gain (or a
 * regression) is "none" and is never shown as progress at all.
 */
export function computeStrengthProgress(sets: HistoricalSet[], range: TimeRange): StrengthProgress {
  const qualifying = sets.filter((s) => s.reps >= TOP_SET_MIN_REPS);
  const rangeFiltered = filterByTimeRange(qualifying, range);
  const points = topSetProgressionDetailed(rangeFiltered);
  const summary = summarizeProgress(points);

  if (!summary || summary.deltaKg <= 0) {
    return { level: 'none', points, summary };
  }

  const sustained = points.length >= SUSTAINED_SESSION_COUNT;
  const clearGain = summary.percent >= SIGNIFICANT_PERCENT;
  return { level: sustained && clearGain ? 'significant' : 'progressing', points, summary };
}
