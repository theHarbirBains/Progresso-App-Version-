// A workout's time, told apart (explicitly requested): its session -- start to finish, rests,
// pauses and breaks all in it -- and its active training, the strength part and the cardio.
//
// Strength training runs from the workout's start to the moment the strength part ended -- Finish's
// "Add Cardio" in the live workout (`workouts.strength_ended_at`), or the workout's finish when it
// never ended early -- less the cardio done before that moment (warming up on the bike before
// lifting, a run between exercises). Cardio is each activity's own typed-in time. Total active
// training is the two together. Nothing here is stored: it's worked out from the workout and its
// cardio wherever it's shown, so an edit or a removal puts every figure right at once.

export interface WorkoutTimeInput {
  performedAt: string;
  completedAt: string | null;
  strengthEndedAt?: string | null;
  /** Whether it has a working set finished -- with none, there's no strength part. */
  hasStrength: boolean;
  cardio: { durationSeconds: number; afterStrength?: boolean }[];
}

export interface WorkoutTimes {
  /** Start to finish; null while it's going, or when it was logged with no duration. */
  sessionSeconds: number | null;
  /** Null when unknown (logged with no duration) or when there's no strength part at all. */
  strengthSeconds: number | null;
  cardioSeconds: number;
  /** Strength and cardio together; null when the strength part's time is unknown. */
  activeSeconds: number | null;
}

function seconds(from: string, to: string): number {
  return Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 1000));
}

/** A finished workout's times (or, with `now`, one still going). */
export function workoutTimes(input: WorkoutTimeInput, now?: Date): WorkoutTimes {
  const cardioSeconds = input.cardio.reduce((sum, entry) => sum + entry.durationSeconds, 0);
  const end = input.completedAt ?? (now ? now.toISOString() : null);
  const session = end === null ? null : seconds(input.performedAt, end);
  // Logged with no duration (Log Past Workout's is optional): its session isn't known.
  const sessionSeconds = session === 0 ? null : session;

  if (!input.hasStrength) {
    return { sessionSeconds, strengthSeconds: null, cardioSeconds, activeSeconds: cardioSeconds };
  }
  const strengthEnd = input.strengthEndedAt ?? end;
  const window = strengthEnd === null ? 0 : seconds(input.performedAt, strengthEnd);
  if (window === 0) {
    return { sessionSeconds, strengthSeconds: null, cardioSeconds, activeSeconds: null };
  }
  const cardioBefore = input.cardio
    .filter((entry) => !entry.afterStrength)
    .reduce((sum, entry) => sum + entry.durationSeconds, 0);
  const strengthSeconds = Math.max(0, window - cardioBefore);
  return {
    sessionSeconds,
    strengthSeconds,
    cardioSeconds,
    activeSeconds: strengthSeconds + cardioSeconds,
  };
}

/** Total active training in whole minutes, as a workout's card shows it; null when unknown. */
export function activeMinutesOf(input: WorkoutTimeInput): number | null {
  const { activeSeconds } = workoutTimes(input);
  return activeSeconds === null ? null : Math.round(activeSeconds / 60);
}

/** "35 min", "1h 5m" -- whole minutes, rounded, as a workout's duration is shown everywhere. */
export function formatMinutes(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes} min`;
}
