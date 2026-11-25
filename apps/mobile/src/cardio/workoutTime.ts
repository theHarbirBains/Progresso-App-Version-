// A workout's time (Harbir's rule): its total time, and how much of it was cardio and how much
// strength training. The total is the workout's time start to finish -- the cardio and the strength
// training together -- or, where the cardio typed in comes to more than that (logged afterwards),
// the cardio's; for cardio alone, the cardio's time. Cardio is each activity's own typed-in time;
// strength training is the rest of the total. Nothing here is stored: it's worked out from the
// workout and its cardio wherever it's shown, so an edit or a removal puts every figure right at
// once.

export interface WorkoutTimeInput {
  performedAt: string;
  completedAt: string | null;
  /** Whether it has a working set finished -- with none, there's no strength part. */
  hasStrength: boolean;
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
  const totalSeconds = Math.max(span, cardioSeconds);
  return { totalSeconds, strengthSeconds: totalSeconds - cardioSeconds, cardioSeconds };
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
