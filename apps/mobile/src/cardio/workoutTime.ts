// A workout's time (Harbir's rule): its total time, and how much of it was cardio and how much
// strength training -- the two together making the total. Cardio is each activity's own typed-in
// time. The strength training is the workout's own time, start to finish, less whatever cardio was
// done within it: cardio fits in that time beside the lifting (the time from set to set, as each
// was finished) as far as there's room -- before the first set, after the last, or in a long gap
// between exercises -- and cardio there isn't room for was done outside it (before the workout was
// started, or after it was finished), so it adds to the total instead of taking from the lifting.
// An hour with 25 minutes on the treadmill inside it: 35 minutes of strength training, an hour in
// all. 45 minutes of lifting and an hour on the treadmill done outside it: 45 minutes of strength
// training, 1h 45m in all. For cardio alone, the cardio's time. Nothing here is stored: it's worked
// out from the workout, its sets and its cardio wherever it's shown, so an edit or a removal puts
// every figure right at once.

export interface WorkoutTimeInput {
  performedAt: string;
  completedAt: string | null;
  /** Whether it has a working set finished -- with none, there's no strength part. */
  hasStrength: boolean;
  /**
   * When each of its finished sets was finished, warm-ups and drops too: how long the lifting
   * took. Sets logged after the fact share one time, so they measure nothing -- the cardio then
   * is within the workout's time if it fits in it, and on top of it if it's as long or longer.
   */
  setTimes?: readonly string[];
  cardio: { durationSeconds: number }[];
}

export interface WorkoutTimes {
  /** The workout's whole time; null while it's going, when it was logged with no duration and
   * has strength training (whose time isn't known then), or when there's nothing in it. */
  totalSeconds: number | null;
  /** Of the total, the strength training; null with no strength part, or no total. */
  strengthSeconds: number | null;
  /** Of the total, the cardio: every activity's own time together. */
  cardioSeconds: number;
}

function seconds(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
}

/**
 * A gap between two sets longer than this wasn't lifting -- a long break, or cardio between
 * exercises -- so it's room the cardio may have been done in.
 */
export const LIFTING_GAP_SECONDS = 10 * 60;

/** When each set of a workout's exercises was finished, warm-ups and drops too. */
export function finishedSetTimes(
  exercises: readonly { sets: readonly { completedAt: string | null }[] }[],
): string[] {
  return exercises.flatMap((exercise) =>
    exercise.sets.flatMap((set) => (set.completedAt ? [set.completedAt] : [])),
  );
}

/** The time spent lifting: from each finished set to the next, leaving out any longer gap. */
export function liftingSeconds(setTimes: readonly string[]): number {
  const times = setTimes
    .map((at) => new Date(at).getTime())
    .filter((at) => Number.isFinite(at))
    .sort((a, b) => a - b);
  let total = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = (times[i]! - times[i - 1]!) / 1000;
    if (gap <= LIFTING_GAP_SECONDS) total += gap;
  }
  return Math.round(total);
}

/** A finished workout's times (or, with `now`, one still going). */
export function workoutTimes(input: WorkoutTimeInput, now?: Date): WorkoutTimes {
  const cardioSeconds = input.cardio.reduce((sum, entry) => sum + entry.durationSeconds, 0);
  // Cardio alone: its time is the cardio's -- there's nothing else to add to it.
  if (!input.hasStrength) {
    return {
      totalSeconds: cardioSeconds > 0 ? cardioSeconds : null,
      strengthSeconds: null,
      cardioSeconds,
    };
  }
  const end = input.completedAt ?? (now ? now.toISOString() : null);
  const span = end === null ? 0 : seconds(input.performedAt, end);
  // No span: going without `now`, or logged with no duration (Log Past Workout's is optional) --
  // the strength training's time isn't known then, so neither is the total.
  if (span === 0) return { totalSeconds: null, strengthSeconds: null, cardioSeconds };
  // The cardio done within the workout's own time: as much as there's room for beside the
  // lifting. The rest was done outside it, and adds to the total.
  const lifting = Math.min(span, liftingSeconds(input.setTimes ?? []));
  const within =
    lifting > 0
      ? Math.min(cardioSeconds, span - lifting)
      : // No lifting measured (sets logged after the fact share one time): cardio that fits in the
        // time typed was done within it; cardio as long as the whole of it or longer can't have
        // been, with lifting in it too -- it was done outside it, and adds to it.
        cardioSeconds < span
        ? cardioSeconds
        : 0;
  return {
    totalSeconds: span + (cardioSeconds - within),
    strengthSeconds: span - within,
    cardioSeconds,
  };
}

/** The workout's total time in whole minutes, as its card shows it; null when unknown. */
export function totalMinutesOf(input: WorkoutTimeInput): number | null {
  const { totalSeconds } = workoutTimes(input);
  return totalSeconds === null ? null : Math.round(totalSeconds / 60);
}

/** "35 min", "1h 5m" -- whole minutes, rounded, as a workout's duration is shown everywhere. */
export function formatMinutes(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes} min`;
}
