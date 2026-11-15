import type { MeasurementType } from '../exercises/movementTypes';
import { formatDuration } from '../lib/duration';
import { formatWeightKg } from '../lib/units';

/**
 * A best or top set as a profile shows it: "100 kg × 5" for weights, "25 reps" for bodyweight,
 * "1:30" for timed.
 */
export function setText(
  set: { weightKg: number | null; reps: number | null; durationSeconds: number | null },
  type: MeasurementType,
  unit: 'kg' | 'lb',
): string {
  if (type === 'timed') return formatDuration(set.durationSeconds ?? 0);
  if (type === 'bodyweight') return `${set.reps ?? 0} ${set.reps === 1 ? 'rep' : 'reps'}`;
  return `${formatWeightKg(set.weightKg ?? 0, unit)} ${unit} × ${set.reps ?? 0}`;
}
