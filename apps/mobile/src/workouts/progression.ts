import type { MeasurementType, MovementType } from '../exercises/movementTypes';
import type { TrainingComfort } from '../lib/api';
import { formatWeightKg } from '../lib/units';
import { bestLoggedSet, loggedSets } from './setValues';
import type { SetRecord } from './workoutQueries';

// Progressive overload, worked out from sets already logged. Nothing here stores anything or
// changes a weight: it only says what to aim for.
//
// Everyone has their own rep range (Settings > Workout Preferences), and any exercise can have
// its own instead (exerciseSettingsQueries.ts): an exercise's own range wins over theirs.
// - Next time an exercise is done, each of last session's sets that reached the top of the
//   range, or beyond, says to go up -- by the exercise's own step when it has one (5 lb
//   dumbbells, 2.5 kg plates), otherwise 5 lb or 2.5 kg -- or, for a bodyweight exercise, to
//   make it harder (more reps, the weighted version). Short of the top, nothing is said: there's
//   no increment to recommend yet. A timed exercise has no range, so it's never told.
// - In the workout itself, once today's top set reaches the top, it says so.
// Falling short is never called a bad set, and the app never suggests going lighter.
//
// Not a PR, a Top Set or a 1RM: those keep their own definitions and records.

export interface RepRange {
  min: number;
  max: number;
}

/** The range onboarding starts someone on: 8-12 while still learning, 5-10 once experienced. */
export function defaultRepRange(comfort: TrainingComfort | null): RepRange {
  return comfort === 'plans_and_progresses' || comfort === 'follows_method'
    ? { min: 5, max: 10 }
    : { min: 8, max: 12 };
}

/** "8–12", or "5" for a range of one number. */
export function formatRepRange(range: RepRange): string {
  return range.min === range.max ? String(range.min) : `${range.min}–${range.max}`;
}

const KG_PER_LB = 0.45359237;

/** The step to go heavier by when an exercise has none of its own: 5 lb, or 2.5 kg. */
export function defaultIncrementKg(unit: 'kg' | 'lb'): number {
  return unit === 'lb' ? 5 * KG_PER_LB : 2.5;
}

/** The range an exercise is judged against: its own when it has one, otherwise the person's. */
export function effectiveRepRange(personal: RepRange, exerciseRange: RepRange | null): RepRange {
  return exerciseRange ?? personal;
}

/** A session's top set for what the exercise measures: the heaviest, the most reps, the longest. */
interface TopSet {
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
}

/**
 * The top set, or for a unilateral exercise each side's top set taken together: the heavier of
 * the two weights, and the lower of the two reps or times, so the top is only reached once both
 * sides reach it. Null when nothing was logged (or only one side was).
 */
export function topSetOf(
  sets: SetRecord[],
  type: MeasurementType,
  movementType: MovementType,
): TopSet | null {
  if (movementType !== 'unilateral') {
    const top = bestLoggedSet(sets, type);
    return top
      ? { weightKg: top.weightKg, reps: top.reps, durationSeconds: top.durationSeconds ?? null }
      : null;
  }
  const left = bestLoggedSet(
    sets.filter((set) => set.side === 'left'),
    type,
  );
  const right = bestLoggedSet(
    sets.filter((set) => set.side === 'right'),
    type,
  );
  if (!left || !right) return null;
  const lower = (a: number | null | undefined, b: number | null | undefined) =>
    a == null || b == null ? null : Math.min(a, b);
  return {
    weightKg:
      left.weightKg == null || right.weightKg == null
        ? null
        : Math.max(left.weightKg, right.weightKg),
    reps: lower(left.reps, right.reps),
    durationSeconds: lower(left.durationSeconds, right.durationSeconds),
  };
}

function weightText(kg: number, unit: 'kg' | 'lb'): string {
  return `${formatWeightKg(kg, unit)} ${unit}`;
}

interface CueInput {
  measurementType: MeasurementType;
  movementType: MovementType;
  range: RepRange;
  unit: 'kg' | 'lb';
  /** How much heavier to suggest, in kg -- the exercise's own step or the default. */
  incrementKg?: number;
  /** The weighted version of this exercise in the person's library ("Weighted Pull-Up"), if any. */
  weightedVariant?: string | null;
}

/**
 * Next time, on last session's sets: each set that reached the top of the range, or beyond,
 * gets one short line to go up -- "Hit 10! Go up to 77.5 lb today." -- or, for a bodyweight
 * exercise, to make it harder. Keyed by the set's place in that session (1 for its first set),
 * as Last Time's Sets numbers them. A set short of the top gets nothing, and a timed exercise,
 * which has no range, gets nothing.
 */
export function lastTimeFlags(
  input: Omit<CueInput, 'movementType'> & { lastSessionSets: SetRecord[] },
): Record<number, string> {
  const { measurementType, range, unit, weightedVariant } = input;
  const step = input.incrementKg ?? defaultIncrementKg(unit);
  const flags: Record<number, string> = {};
  if (measurementType === 'timed') return flags;
  input.lastSessionSets.forEach((set, index) => {
    if (set.completedAt === null || set.reps == null || set.reps < range.max) return;
    if (measurementType === 'bodyweight') {
      flags[index + 1] = weightedVariant
        ? `Hit ${set.reps}! Try ${weightedVariant} today.`
        : `Hit ${set.reps}! Go for ${set.reps + 1} today.`;
    } else if (set.weightKg != null) {
      flags[index + 1] =
        `Hit ${set.reps}! Go up to ${weightText(set.weightKg + step, unit)} today.`;
    }
  });
  return flags;
}

/** Said in the workout itself once today's top set reaches the top of the range (or beats last time). */
export function thisSessionCue(
  input: Omit<CueInput, 'unit'> & {
    sets: SetRecord[];
    lastSessionSets?: SetRecord[];
  },
): string | null {
  const { measurementType, movementType, range, weightedVariant } = input;
  const top = topSetOf(loggedSets(input.sets, measurementType), measurementType, movementType);
  if (!top) return null;

  if (measurementType === 'timed') {
    const last = input.lastSessionSets
      ? topSetOf(input.lastSessionSets, measurementType, movementType)
      : null;
    if (top.durationSeconds == null || last?.durationSeconds == null) return null;
    return top.durationSeconds > last.durationSeconds ? 'A new time: longer than last time.' : null;
  }

  if (top.reps == null || top.reps < range.max) return null;
  if (measurementType === 'bodyweight') {
    return weightedVariant
      ? `Top of your range. Next time, add reps or try ${weightedVariant}.`
      : 'Top of your range. Next time, go for more reps.';
  }
  return 'Top of your range. Increase the weight next time.';
}

/** An exercise's all-time best set, as the live workout shows it. */
export interface AllTimeBest {
  measurementType: MeasurementType;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  /** When it was set; null when it's one of today's own sets. */
  achievedAt: string | null;
}

/**
 * The best this person has ever done at an exercise, from the records the database keeps and
 * today's own completed sets (which the records the app loaded don't include yet):
 * - weight and reps: the heaviest set within their rep range (more reps breaking a tie) -- the
 *   rep range is the default, so it isn't named. With nothing in the range yet, the heaviest
 *   set at any rep count;
 * - bodyweight: the most reps; timed: the longest time.
 * A set of today's beats the record only by being better, never by tying it. Null when there's
 * nothing logged yet.
 */
export function allTimeBest(input: {
  measurementType: MeasurementType;
  range: RepRange;
  /** This exercise's rep-count PRs. */
  repPRs: { reps: number; bestWeightKg: number; achievedAt: string; sourceSetId: string }[];
  /** This exercise's most-reps or longest-time record, when it has one. */
  record: { value: number; achievedAt: string; sourceSetId: string } | null;
  /** This workout's own sets of the exercise; only completed ones count. */
  todaySets: SetRecord[];
}): AllTimeBest | null {
  const { measurementType, range } = input;
  const today = loggedSets(input.todaySets, measurementType);
  const todayIds = new Set(today.map((set) => set.id));
  const when = (achievedAt: string, setId: string) => (todayIds.has(setId) ? null : achievedAt);

  if (measurementType !== 'weight_reps') {
    const value = (set: SetRecord) =>
      (measurementType === 'bodyweight' ? set.reps : set.durationSeconds) ?? 0;
    let best: { value: number; achievedAt: string | null } | null = input.record
      ? {
          value: input.record.value,
          achievedAt: when(input.record.achievedAt, input.record.sourceSetId),
        }
      : null;
    for (const set of today) {
      if (!best || value(set) > best.value) best = { value: value(set), achievedAt: null };
    }
    if (!best) return null;
    return {
      measurementType,
      weightKg: null,
      reps: measurementType === 'bodyweight' ? best.value : null,
      durationSeconds: measurementType === 'timed' ? best.value : null,
      achievedAt: best.achievedAt,
    };
  }

  // The records first, so one of today's sets only wins by being better.
  const candidates = [
    ...input.repPRs.map((pr) => ({
      weightKg: pr.bestWeightKg,
      reps: pr.reps,
      achievedAt: when(pr.achievedAt, pr.sourceSetId),
    })),
    ...today.map((set) => ({
      weightKg: set.weightKg ?? 0,
      reps: set.reps ?? 0,
      achievedAt: null,
    })),
  ];
  const inRange = candidates.filter((c) => c.reps >= range.min && c.reps <= range.max);
  let best: (typeof candidates)[number] | null = null;
  for (const candidate of inRange.length > 0 ? inRange : candidates) {
    if (
      !best ||
      candidate.weightKg > best.weightKg ||
      (candidate.weightKg === best.weightKg && candidate.reps > best.reps)
    ) {
      best = candidate;
    }
  }
  return best
    ? {
        measurementType,
        weightKg: best.weightKg,
        reps: best.reps,
        durationSeconds: null,
        achievedAt: best.achievedAt,
      }
    : null;
}

/**
 * The weighted version of an exercise in the person's library: an active weight-and-reps
 * exercise named "Weighted <name>" (Pull-Up → Weighted Pull-Up). Null when there isn't one.
 */
export function findWeightedVariant(
  exerciseName: string,
  library: { name: string; measurementType: MeasurementType; isActive: boolean }[],
): string | null {
  const wanted = `weighted ${exerciseName}`.trim().toLowerCase();
  const match = library.find(
    (exercise) =>
      exercise.isActive &&
      exercise.measurementType === 'weight_reps' &&
      exercise.name.trim().toLowerCase() === wanted,
  );
  return match?.name ?? null;
}

/** An exercise's own range and step, when the person set them. */
export interface ExerciseOverride {
  range: RepRange | null;
  incrementKg: number | null;
}

/** The person's progression settings, from their profile. */
export interface ProgressionSettings {
  range: RepRange;
  /** Whether to say anything at all (Settings > Workout Preferences > Progression Tips). */
  enabled: boolean;
  unit: 'kg' | 'lb';
}

/**
 * Everything the live workout's exercise card shows about progression: the all-time best (shown
 * even with suggestions off: it's a record, not a suggestion), the messages on last session's
 * sets that reached the top of the range, and what today's own sets already show.
 */
export function progressionForExercise(input: {
  exercise: {
    exerciseId: string;
    exerciseName: string;
    movementType: MovementType;
    measurementType?: MeasurementType | null;
    sets: SetRecord[];
  };
  lastSessionSets: SetRecord[] | undefined;
  settings: ProgressionSettings;
  /** Every rep-count PR the person holds (filtered to this exercise here). */
  repPRs: {
    exerciseId: string;
    reps: number;
    bestWeightKg: number;
    achievedAt: string;
    sourceSetId: string;
  }[];
  /** Every most-reps or longest-time record the person holds. */
  records: {
    exerciseId: string;
    measurementType: MeasurementType;
    value: number;
    achievedAt: string;
    sourceSetId: string;
  }[];
  /** The person's exercise library, to find a weighted version. */
  library: { name: string; measurementType: MeasurementType; isActive: boolean }[];
  /** This exercise's own range and step, when it has them. */
  override?: ExerciseOverride | null;
}): {
  allTimeBest: AllTimeBest | null;
  lastTimeFlags: Record<number, string>;
  sessionCue: string | null;
} {
  const { exercise, settings, lastSessionSets } = input;
  const measurementType = exercise.measurementType ?? 'weight_reps';
  const weightedVariant =
    measurementType === 'weight_reps'
      ? null
      : findWeightedVariant(exercise.exerciseName, input.library);
  const range = effectiveRepRange(settings.range, input.override?.range ?? null);
  const shared = {
    measurementType,
    movementType: exercise.movementType,
    range,
    weightedVariant,
  };
  return {
    allTimeBest: allTimeBest({
      measurementType,
      range,
      repPRs: input.repPRs.filter((pr) => pr.exerciseId === exercise.exerciseId),
      record:
        input.records.find(
          (record) =>
            record.exerciseId === exercise.exerciseId && record.measurementType === measurementType,
        ) ?? null,
      todaySets: exercise.sets,
    }),
    lastTimeFlags:
      settings.enabled && lastSessionSets
        ? lastTimeFlags({
            measurementType,
            range,
            weightedVariant,
            unit: settings.unit,
            incrementKg: input.override?.incrementKg ?? undefined,
            lastSessionSets,
          })
        : {},
    sessionCue: settings.enabled
      ? thisSessionCue({ ...shared, sets: exercise.sets, lastSessionSets })
      : null,
  };
}
