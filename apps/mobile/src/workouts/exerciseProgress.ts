import type { HistoricalSet } from './exerciseHistoryQueries';

// Pure, deterministic derivations over raw historical sets -- no estimation,
// no interpolation, no invented data points. Every function here only ever
// reads what was actually logged.

export interface ChartPoint {
  performedAt: string;
  weightKg: number;
}

export type TimeRange = '4w' | '3m' | '6m' | '1y' | 'all';

export const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '4w', label: '4 Weeks' },
  { value: '3m', label: '3 Months' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
];

const RANGE_DAYS: Record<Exclude<TimeRange, 'all'>, number> = {
  '4w': 28,
  '3m': 90,
  '6m': 182,
  '1y': 365,
};

/** Keeps only sets performed within the given range, measured back from `now`. */
export function filterByTimeRange(
  sets: HistoricalSet[],
  range: TimeRange,
  now: Date = new Date(),
): HistoricalSet[] {
  if (range === 'all') return sets;
  const cutoffMs = now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  return sets.filter((s) => new Date(s.performedAt).getTime() >= cutoffMs);
}

/** One heaviest set per workout occurrence, chronologically ascending. */
function bestSetPerOccurrence(sets: HistoricalSet[]): HistoricalSet[] {
  const bestByOccurrence = new Map<string, HistoricalSet>();
  for (const s of sets) {
    const current = bestByOccurrence.get(s.workoutExerciseId);
    if (!current || s.weightKg > current.weightKg) {
      bestByOccurrence.set(s.workoutExerciseId, s);
    }
  }
  return Array.from(bestByOccurrence.values()).sort(
    (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime(),
  );
}

/**
 * One point per workout occurrence of this exercise, plotting that
 * session's heaviest set. Input does not need to be pre-sorted; output is
 * chronological ascending.
 */
export function topSetProgression(sets: HistoricalSet[]): ChartPoint[] {
  return bestSetPerOccurrence(sets).map((s) => ({
    performedAt: s.performedAt,
    weightKg: s.weightKg,
  }));
}

/** Same as topSetProgression, but keeps reps/workoutExerciseId for the Progress feature's interactive chart (point-detail panel needs "225 lb x 5", not just the weight). */
export interface DetailedChartPoint extends ChartPoint {
  reps: number;
  workoutExerciseId: string;
}

export function topSetProgressionDetailed(sets: HistoricalSet[]): DetailedChartPoint[] {
  return bestSetPerOccurrence(sets).map((s) => ({
    performedAt: s.performedAt,
    weightKg: s.weightKg,
    reps: s.reps,
    workoutExerciseId: s.workoutExerciseId,
  }));
}

/**
 * Total change from the first recorded point to the last -- the
 * "progressive overload story" (starting point / current point / total
 * improvement / percentage improvement), computed only from real logged
 * points. Returns null when there's fewer than 2 points (nothing to compare).
 */
export interface ProgressSummary {
  startKg: number;
  currentKg: number;
  deltaKg: number;
  percent: number;
}

export function summarizeProgress(points: { weightKg: number }[]): ProgressSummary | null {
  if (points.length < 2) return null;
  const startKg = points[0].weightKg;
  const currentKg = points[points.length - 1].weightKg;
  const deltaKg = currentKg - startKg;
  const percent = startKg > 0 ? (deltaKg / startKg) * 100 : 0;
  return { startKg, currentKg, deltaKg, percent };
}

/**
 * The chronological running maximum weight of whatever sets are passed in
 * -- the caller pre-filters to one rep count (or reps === 1 for true 1RM).
 * This is the historical reconstruction of what rep_prs/one_rep_maxes would
 * have said at each point in time, derived only from real logged sets.
 */
export function runningMax(sets: HistoricalSet[]): ChartPoint[] {
  const sorted = [...sets].sort(
    (a, b) => new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime(),
  );
  const points: ChartPoint[] = [];
  let best = -Infinity;
  for (const s of sorted) {
    if (s.weightKg > best) {
      best = s.weightKg;
      points.push({ performedAt: s.performedAt, weightKg: s.weightKg });
    }
  }
  return points;
}

/** Running maximum at one specific rep count (reps >= 2), e.g. the 8-rep PR over time. */
export function repCountPRProgression(sets: HistoricalSet[], reps: number): ChartPoint[] {
  return runningMax(sets.filter((s) => s.reps === reps));
}

/** Running maximum among actual 1-rep sets only -- never estimated. */
export function trueOneRepMaxProgression(sets: HistoricalSet[]): ChartPoint[] {
  return runningMax(sets.filter((s) => s.reps === 1));
}

/**
 * The rep count logged most often (reps >= 2) -- used to auto-select which
 * rep-count PR progression to chart without requiring a picker. Ties break
 * toward the lower rep count for determinism.
 */
export function mostCommonRepCount(sets: HistoricalSet[]): number | null {
  const counts = new Map<number, number>();
  for (const s of sets) {
    if (s.reps < 2) continue;
    counts.set(s.reps, (counts.get(s.reps) ?? 0) + 1);
  }
  if (counts.size === 0) return null;

  let best: number | null = null;
  let bestCount = 0;
  for (const [reps, count] of [...counts.entries()].sort(([a], [b]) => a - b)) {
    if (count > bestCount) {
      best = reps;
      bestCount = count;
    }
  }
  return best;
}

/** Number of distinct sessions (workout occurrences) this exercise appears in. */
export function workoutFrequency(sets: HistoricalSet[]): number {
  return new Set(sets.map((s) => s.workoutExerciseId)).size;
}
