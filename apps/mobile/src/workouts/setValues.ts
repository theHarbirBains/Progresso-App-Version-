import type { MeasurementType } from '../exercises/movementTypes';
import { formatDuration } from '../lib/duration';
import { formatWeightKg } from '../lib/units';
import type { SetRecord } from './workoutQueries';

// What a set holds, by what its exercise measures -- a weight and reps, reps only
// (bodyweight), or a duration (timed). Pure, like setCompletion.ts, so anything client-side
// can use it without pulling in Supabase.
//
// Weight-based numbers -- Top Sets, volume, rep PRs, true 1RMs, strength charts -- stay
// weighted-only and keep using completedSetsOnly on weight_reps exercises. This is for
// everything that shows or counts sets of any kind.

/** Whether a set holds the values its exercise records (weight and reps; reps; a duration). */
export function holdsMeasurement(set: SetRecord, type: MeasurementType): boolean {
  switch (type) {
    case 'weight_reps':
      return set.weightKg !== null && set.reps !== null;
    case 'bodyweight':
      return set.reps !== null;
    case 'timed':
      return set.durationSeconds != null;
  }
}

/** The completed sets that hold what their exercise records, in the order given. */
export function loggedSets(sets: SetRecord[], type: MeasurementType): SetRecord[] {
  return sets.filter((set) => set.completedAt !== null && holdsMeasurement(set, type));
}

function score(set: SetRecord, type: MeasurementType): number {
  switch (type) {
    case 'weight_reps':
      return set.weightKg ?? 0;
    case 'bodyweight':
      return set.reps ?? 0;
    case 'timed':
      return set.durationSeconds ?? 0;
  }
}

/**
 * The set that best shows a session of this exercise: the heaviest for weight and reps (the
 * Top Set), the most reps at bodyweight, the longest hold when timed. The first one logged
 * wins a tie. Null when nothing was logged.
 */
export function bestLoggedSet(sets: SetRecord[], type: MeasurementType): SetRecord | null {
  let best: SetRecord | null = null;
  for (const set of loggedSets(sets, type)) {
    if (!best || score(set, type) > score(best, type)) best = set;
  }
  return best;
}

/** A set's values as a top set carries them: only the ones its type records. */
export interface SetValues {
  measurementType: MeasurementType;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

export function setValuesOf(set: SetRecord, type: MeasurementType): SetValues {
  return {
    measurementType: type,
    weightKg: type === 'weight_reps' ? set.weightKg : null,
    reps: type === 'timed' ? null : set.reps,
    durationSeconds: type === 'timed' ? (set.durationSeconds ?? null) : null,
  };
}

/** "100 kg × 5", "15 reps", "1:30". A missing type means weight and reps. */
export function formatSetValues(
  values: {
    measurementType?: MeasurementType | null;
    weightKg?: number | null;
    reps?: number | null;
    durationSeconds?: number | null;
  },
  unit: 'kg' | 'lb',
): string {
  switch (values.measurementType ?? 'weight_reps') {
    case 'bodyweight': {
      const reps = values.reps ?? 0;
      return `${reps} ${reps === 1 ? 'rep' : 'reps'}`;
    }
    case 'timed':
      return formatDuration(values.durationSeconds ?? 0);
    default:
      return `${formatWeightKg(values.weightKg ?? 0, unit)} ${unit} × ${values.reps ?? 0}`;
  }
}
