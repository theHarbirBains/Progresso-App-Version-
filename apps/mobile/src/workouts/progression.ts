import type { MeasurementType, MovementType } from '../exercises/movementTypes';
import { formatDuration } from '../lib/duration';
import type { TrainingComfort } from '../lib/api';
import { formatWeightKg } from '../lib/units';
import { bestLoggedSet, loggedSets } from './setValues';
import type { SetRecord } from './workoutQueries';

// Progressive overload, worked out from sets already logged. Nothing here stores anything or
// changes a weight: it only says what to aim for.
//
// Everyone has their own rep range (Settings > Workout Preferences), and any exercise can have
// its own instead (exerciseSettingsQueries.ts): an exercise's own range wins over theirs. For a
// weighted exercise, its top set (the heaviest completed set, the first one if several tie --
// the same Top Set shown everywhere else) is judged against that range:
// - reaching the top of the range, or beyond, means increase the weight next time -- by the
//   exercise's own step when it has one (5 lb dumbbells, 2.5 kg plates), otherwise 5 lb or
//   2.5 kg -- picking one you can lift for about the bottom of the range, then building back up
//   week by week;
// - anything short of the top is still good: stay at that weight and work toward the top.
// Falling short is never called a bad set, and the app never suggests going lighter.
//
// A bodyweight exercise's best set is judged the same way, and at the top it gets ways to make
// it harder (more reps, the weighted version). A timed exercise has no range: it's always
// asked to beat its last time.
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

/** Whether someone asked for guidance: they get a one-line why under each suggestion. */
export function wantsGuidance(comfort: TrainingComfort | null): boolean {
  return comfort === 'still_learning' || comfort === 'knows_basics';
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

/** A suggestion for the next time an exercise is done. */
export interface ProgressionCue {
  headline: string;
  /** Ways to make a bodyweight or timed exercise harder, one per line. */
  options: string[];
  /** A one-line why, for people who asked for guidance. */
  detail: string | null;
}

export function cuesEqual(a: ProgressionCue | null, b: ProgressionCue | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.headline === b.headline &&
    a.detail === b.detail &&
    a.options.length === b.options.length &&
    a.options.every((option, i) => option === b.options[i])
  );
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

/** How much longer to aim for: 5 seconds under a minute, 10 from a minute up. */
function nextTimeGoal(seconds: number): number {
  return seconds + (seconds < 60 ? 5 : 10);
}

interface CueInput {
  measurementType: MeasurementType;
  movementType: MovementType;
  range: RepRange;
  unit: 'kg' | 'lb';
  guided: boolean;
  /** How much heavier to suggest, in kg -- the exercise's own step or the default. */
  incrementKg?: number;
  /** The weighted version of this exercise in the person's library ("Weighted Pull-Up"), if any. */
  weightedVariant?: string | null;
}

/** What to aim for this time, from the last session with this exercise. */
export function nextSessionCue(
  input: CueInput & { lastSessionSets: SetRecord[] },
): ProgressionCue | null {
  const { measurementType, movementType, range, unit, guided, weightedVariant } = input;
  const incrementKg = input.incrementKg ?? defaultIncrementKg(unit);
  const top = topSetOf(input.lastSessionSets, measurementType, movementType);
  if (!top) return null;
  const bothSides = movementType === 'unilateral' ? ' on both sides' : '';

  if (measurementType === 'timed') {
    if (top.durationSeconds == null) return null;
    return {
      headline: `Last time: ${formatDuration(top.durationSeconds)}. Go for a new time today.`,
      options: [
        `Aim for ${formatDuration(nextTimeGoal(top.durationSeconds))} or more`,
        ...(weightedVariant ? [`Or add weight: try ${weightedVariant}`] : []),
      ],
      detail: guided
        ? 'Holding a little longer each time is how a timed exercise gets harder.'
        : null,
    };
  }

  if (top.reps == null) return null;

  if (measurementType === 'bodyweight') {
    if (top.reps >= range.max) {
      return {
        headline: `Your best set hit ${top.reps} reps${bothSides}, the top of your range. Make it harder today:`,
        options: [
          `Add reps: go for ${top.reps + 1} or more`,
          ...(weightedVariant ? [`Add weight: try ${weightedVariant}`] : []),
        ],
        detail: guided
          ? 'Either one keeps the exercise challenging, so you keep getting stronger.'
          : null,
      };
    }
    return {
      headline: `Last time: ${top.reps} reps. Work toward ${range.max}.`,
      options: [],
      detail: guided ? `When you reach ${range.max}, it's time to make it harder.` : null,
    };
  }

  if (top.weightKg == null) return null;
  const weight = weightText(top.weightKg, unit);
  if (top.reps >= range.max) {
    const heavier = weightText(top.weightKg + incrementKg, unit);
    return {
      headline: `Your top set hit ${top.reps}${bothSides} at ${weight}. Increase the weight today: try ${heavier}.`,
      options: [],
      detail: guided
        ? `Pick a weight you can lift for about ${range.min} reps, then build back up to ${range.max}.`
        : null,
    };
  }
  return {
    headline: `Last time: ${top.reps} at ${weight}. Keep ${weight} and work toward ${range.max}.`,
    options: [],
    detail: guided ? `When your top set reaches ${range.max}, it's time to go heavier.` : null,
  };
}

/** Said in the workout itself once today's top set reaches the top of the range (or beats last time). */
export function thisSessionCue(
  input: Omit<CueInput, 'unit' | 'guided'> & {
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

/**
 * The best this person has done within their range, from records the database already keeps:
 * "Best at 8–12: 60 lb × 9" (the heaviest of their rep-count PRs inside the range), "Most reps:
 * 25" for a bodyweight exercise, "Longest: 1:45" for a timed one. Null when there's none yet.
 */
export function bestLine(input: {
  measurementType: MeasurementType;
  range: RepRange;
  unit: 'kg' | 'lb';
  /** This exercise's rep-count PRs. */
  repPRs: { reps: number; bestWeightKg: number }[];
  /** This exercise's most-reps or longest-time record, when it has one. */
  recordValue: number | null;
}): string | null {
  const { measurementType, range, unit } = input;
  if (measurementType === 'bodyweight') {
    return input.recordValue != null ? `Most reps: ${input.recordValue}` : null;
  }
  if (measurementType === 'timed') {
    return input.recordValue != null ? `Longest: ${formatDuration(input.recordValue)}` : null;
  }
  let best: { reps: number; bestWeightKg: number } | null = null;
  for (const pr of input.repPRs) {
    if (pr.reps < range.min || pr.reps > range.max) continue;
    if (
      !best ||
      pr.bestWeightKg > best.bestWeightKg ||
      (pr.bestWeightKg === best.bestWeightKg && pr.reps > best.reps)
    ) {
      best = pr;
    }
  }
  return best
    ? `Best at ${formatRepRange(range)}: ${weightText(best.bestWeightKg, unit)} × ${best.reps}`
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
  guided: boolean;
  unit: 'kg' | 'lb';
}

/**
 * Everything the live workout's exercise card shows about progression: the best within the
 * range (shown even with suggestions off: it's a record, not a suggestion), what to aim for
 * today from the last session, and what today's own sets already show.
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
  repPRs: { exerciseId: string; reps: number; bestWeightKg: number }[];
  /** Every most-reps or longest-time record the person holds. */
  records: { exerciseId: string; measurementType: MeasurementType; value: number }[];
  /** The person's exercise library, to find a weighted version. */
  library: { name: string; measurementType: MeasurementType; isActive: boolean }[];
  /** This exercise's own range and step, when it has them. */
  override?: ExerciseOverride | null;
}): {
  bestLine: string | null;
  progressionCue: ProgressionCue | null;
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
    bestLine: bestLine({
      measurementType,
      range,
      unit: settings.unit,
      repPRs: input.repPRs.filter((pr) => pr.exerciseId === exercise.exerciseId),
      recordValue:
        input.records.find(
          (record) =>
            record.exerciseId === exercise.exerciseId && record.measurementType === measurementType,
        )?.value ?? null,
    }),
    progressionCue:
      settings.enabled && lastSessionSets
        ? nextSessionCue({
            ...shared,
            unit: settings.unit,
            guided: settings.guided,
            incrementKg: input.override?.incrementKg ?? undefined,
            lastSessionSets,
          })
        : null,
    sessionCue: settings.enabled
      ? thisSessionCue({ ...shared, sets: exercise.sets, lastSessionSets })
      : null,
  };
}
