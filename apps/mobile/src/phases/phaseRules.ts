import type { TargetValues } from '../nutrition/targetMath';
import type { PhaseKind, TrainingPhase } from './phaseQueries';

// Pure rules for training phases -- no I/O.
//
// How a phase's targets meet the daily targets: while a phase is going, each target it has is
// used in place of the daily one, and each it leaves blank falls back to the daily one. The
// daily targets themselves are never changed, and apply again in full when the phase ends.

export const PHASE_KIND_LABELS: Record<PhaseKind, string> = {
  cut: 'Cut',
  bulk: 'Bulk',
  maintenance: 'Maintenance',
  custom: 'Custom',
};

/** "Cut", "Summer Cut", or a custom phase's own name. */
export function phaseLabel(phase: Pick<TrainingPhase, 'kind' | 'name'>): string {
  const name = phase.name?.trim();
  if (phase.kind === 'custom') return name || 'Custom';
  return name || PHASE_KIND_LABELS[phase.kind];
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** "YYYY-MM-DD" for a local day. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The local day a "YYYY-MM-DD" key names, at midnight. */
export function dayFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year!, month! - 1, day!);
}

/** The key of the day before. */
export function dayBefore(key: string): string {
  const date = dayFromKey(key);
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}

/** The phase going on this day, if any: started by then, and not ended before it. */
export function phaseOn(phases: TrainingPhase[], key: string): TrainingPhase | null {
  return (
    phases.find(
      (phase) => phase.startDate <= key && (phase.endDate === null || phase.endDate >= key),
    ) ?? null
  );
}

/** The phase going today, if any. */
export function activePhase(
  phases: TrainingPhase[],
  today: Date = new Date(),
): TrainingPhase | null {
  const phase = phaseOn(phases, dayKey(today));
  return phase && phase.endDate === null ? phase : null;
}

/** Whether a phase has any targets of its own. */
export function hasOwnTargets(phase: TrainingPhase | null): boolean {
  if (!phase) return false;
  const { calories, proteinG, carbsG, fatG } = phase.targets;
  return calories !== null || proteinG !== null || carbsG !== null || fatG !== null;
}

/** The targets that apply: the phase's own where it has them, the daily ones everywhere else. */
export function effectiveTargets(
  daily: TargetValues | null,
  phase: TrainingPhase | null,
): TargetValues {
  const base = daily ?? { calories: null, proteinG: null, carbsG: null, fatG: null };
  if (!phase) return base;
  return {
    calories: phase.targets.calories ?? base.calories,
    proteinG: phase.targets.proteinG ?? base.proteinG,
    carbsG: phase.targets.carbsG ?? base.carbsG,
    fatG: phase.targets.fatG ?? base.fatG,
  };
}

/** How many days a phase has run, its first day counting as day 1, up to its end or today. */
export function phaseDays(phase: TrainingPhase, today: Date = new Date()): number {
  const start = dayFromKey(phase.startDate).getTime();
  const end = phase.endDate
    ? dayFromKey(phase.endDate).getTime()
    : dayFromKey(dayKey(today)).getTime();
  return Math.max(1, Math.round((end - start) / (24 * 60 * 60 * 1000)) + 1);
}

/**
 * Checks a phase before it's saved, in plain words: a start date no later than today, an end
 * no earlier than the start, a name for a custom phase, and no day shared with another phase.
 */
export function validatePhase(
  input: Pick<TrainingPhase, 'kind' | 'name' | 'startDate' | 'endDate'>,
  others: TrainingPhase[],
  today: Date = new Date(),
): string | null {
  const todayKey = dayKey(today);
  if (input.kind === 'custom' && !input.name?.trim()) return 'Give your phase a name.';
  if (input.startDate > todayKey) return 'A phase starts today or on a day before.';
  if (input.endDate !== null && input.endDate < input.startDate) {
    return "A phase can't end before it starts.";
  }
  const end = input.endDate ?? '9999-12-31';
  const clash = others.find(
    (other) => other.startDate <= end && (other.endDate ?? '9999-12-31') >= input.startDate,
  );
  if (clash) {
    return `It would share days with your ${phaseLabel(clash)} (from ${clash.startDate}${clash.endDate ? ` to ${clash.endDate}` : ''}). Phases can't overlap.`;
  }
  return null;
}

export interface PhaseAdherence {
  days: number;
  /** Days in the phase with food logged. */
  loggedDays: number;
  /** Logged days within 10% of the calorie target; null without one. */
  daysOnCalories: number | null;
  avgCalories: number | null;
  /** Completed workouts in the phase, and per week. */
  workouts: number;
  workoutsPerWeek: number;
}

/** How the phase has gone, from what was logged: only days with food logged are judged. */
export function phaseAdherence(input: {
  phase: TrainingPhase;
  calorieTarget: number | null;
  foodLogs: { loggedAt: string; calories: number }[];
  workouts: { performedAt: string }[];
  today?: Date;
}): PhaseAdherence {
  const { phase, calorieTarget } = input;
  const today = input.today ?? new Date();
  const lastKey = phase.endDate ?? dayKey(today);
  const inPhase = (iso: string) => {
    const key = dayKey(new Date(iso));
    return key >= phase.startDate && key <= lastKey;
  };
  const byDay = new Map<string, number>();
  for (const log of input.foodLogs) {
    if (!inPhase(log.loggedAt)) continue;
    const key = dayKey(new Date(log.loggedAt));
    byDay.set(key, (byDay.get(key) ?? 0) + log.calories);
  }
  const dayTotals = [...byDay.values()];
  const days = phaseDays(phase, today);
  const workouts = input.workouts.filter((workout) => inPhase(workout.performedAt)).length;
  return {
    days,
    loggedDays: dayTotals.length,
    daysOnCalories:
      calorieTarget === null
        ? null
        : dayTotals.filter((total) => Math.abs(total - calorieTarget) <= calorieTarget * 0.1)
            .length,
    avgCalories:
      dayTotals.length > 0
        ? Math.round(dayTotals.reduce((sum, total) => sum + total, 0) / dayTotals.length)
        : null,
    workouts,
    workoutsPerWeek: Math.round((workouts / (days / 7)) * 10) / 10,
  };
}
