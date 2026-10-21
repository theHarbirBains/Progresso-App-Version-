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
      headline: `Keep building until your best set reaches ${range.max} reps${bothSides}, then we'll recommend how to make it harder.`,
      options: [],
      detail: guided ? 'More reps first, then a harder version, keeps you progressing.' : null,
    };
  }

  if (top.weightKg == null) return null;
  if (top.reps >= range.max) {
    const weight = weightText(top.weightKg, unit);
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
    headline: `Keep your top set weight the same until you reach ${range.max} reps${bothSides}, then we'll recommend your next increment.`,
    options: [],
    detail: guided
      ? 'Owning the top of your range before going heavier keeps your form and your progress steady.'
      : null,
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
  guided: boolean;
  unit: 'kg' | 'lb';
}

/**
 * Everything the live workout's exercise card shows about progression: the all-time best (shown
 * even with suggestions off: it's a record, not a suggestion), what to aim for today from the
 * last session, and what today's own sets already show.
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
