import {
  assessUnfinishedWorkout,
  toUnfinishedWorkoutInput,
  UNFINISHED_THRESHOLDS,
  type UnfinishedWorkoutInput,
} from './unfinishedWorkoutState';

const MIN = 60_000;

// Fixed local-time instant so the calendar-day checks are deterministic.
const NOW = new Date(2026, 9, 4, 18, 0, 0); // 4 Oct 2026, 18:00 local

function minutesBefore(base: Date, minutes: number): string {
  return new Date(base.getTime() - minutes * MIN).toISOString();
}

function workout(overrides: Partial<UnfinishedWorkoutInput> = {}): UnfinishedWorkoutInput {
  return {
    performedAt: minutesBefore(NOW, 60),
    completedSetTimes: [minutesBefore(NOW, 0)],
    plannedBlankSetCount: 0,
    exerciseCount: 2,
    completedExerciseCount: 2,
    ...overrides,
  };
}

// A workout with enough completed sets to be prompted about, last set `idle` minutes ago.
function promptable(idleMinutes: number, overrides: Partial<UnfinishedWorkoutInput> = {}) {
  const lastSet = minutesBefore(NOW, idleMinutes);
  return workout({
    performedAt: minutesBefore(NOW, idleMinutes + 60),
    completedSetTimes: [
      minutesBefore(NOW, idleMinutes + 20),
      minutesBefore(NOW, idleMinutes + 10),
      lastSet,
    ],
    ...overrides,
  });
}

describe('assessUnfinishedWorkout', () => {
  describe('state transitions for a workout with real activity', () => {
    it('is active while the last completed set is recent', () => {
      expect(assessUnfinishedWorkout(promptable(5), NOW).state).toBe('active');
    });

    it('is active just under the possibly-inactive threshold', () => {
      const idle = UNFINISHED_THRESHOLDS.possiblyInactiveMinutes - 1;
      expect(assessUnfinishedWorkout(promptable(idle), NOW).state).toBe('active');
    });

    it('is possibly_inactive at the possibly-inactive threshold, still short of the prompt', () => {
      const idle = UNFINISHED_THRESHOLDS.possiblyInactiveMinutes;
      expect(assessUnfinishedWorkout(promptable(idle), NOW).state).toBe('possibly_inactive');
    });

    it('is suspected_complete at the suspected-complete threshold', () => {
      const idle = UNFINISHED_THRESHOLDS.suspectedCompleteMinutes;
      expect(assessUnfinishedWorkout(promptable(idle), NOW).state).toBe('suspected_complete');
    });

    it('stays suspected_complete for a long idle period', () => {
      expect(assessUnfinishedWorkout(promptable(60 * 6), NOW).state).toBe('suspected_complete');
    });

    it('is suspected_complete on the next calendar day even when the gap is short', () => {
      // Last set at 23:50 the previous evening; now is 00:10 the next day.
      const justPastMidnight = new Date(2026, 9, 5, 0, 10, 0);
      const result = assessUnfinishedWorkout(
        workout({
          performedAt: new Date(2026, 9, 4, 23, 0, 0).toISOString(),
          completedSetTimes: [
            new Date(2026, 9, 4, 23, 20, 0).toISOString(),
            new Date(2026, 9, 4, 23, 35, 0).toISOString(),
            new Date(2026, 9, 4, 23, 50, 0).toISOString(),
          ],
        }),
        justPastMidnight,
      );
      expect(result.state).toBe('suspected_complete');
    });
  });

  describe('thin workouts never get a prompt', () => {
    it('stays active for a thin workout that was touched recently', () => {
      const result = assessUnfinishedWorkout(
        workout({ completedSetTimes: [minutesBefore(NOW, 5)] }),
        NOW,
      );
      expect(result.state).toBe('active');
    });

    it('becomes stale, not suspected_complete, once a thin workout has gone quiet', () => {
      const result = assessUnfinishedWorkout(
        workout({
          completedSetTimes: [minutesBefore(NOW, 300)],
          completedExerciseCount: 1,
        }),
        NOW,
      );
      expect(result.state).toBe('stale');
    });

    it('stays out of the prompt for a thin workout on the next calendar day', () => {
      const result = assessUnfinishedWorkout(
        workout({
          performedAt: new Date(2026, 9, 4, 20, 0, 0).toISOString(),
          completedSetTimes: [new Date(2026, 9, 4, 20, 30, 0).toISOString()],
        }),
        new Date(2026, 9, 5, 9, 0, 0),
      );
      expect(result.state).toBe('stale');
    });

    it('treats a workout just under the set minimum as thin', () => {
      const belowMinimum = UNFINISHED_THRESHOLDS.minCompletedSetsForPrompt - 1;
      const result = assessUnfinishedWorkout(
        workout({
          completedSetTimes: Array.from({ length: belowMinimum }, (_, i) =>
            minutesBefore(NOW, 300 - i),
          ),
        }),
        NOW,
      );
      expect(result.state).toBe('stale');
    });
  });

  describe('a workout with nothing completed', () => {
    it('is active for a freshly started workout', () => {
      const result = assessUnfinishedWorkout(
        workout({
          performedAt: minutesBefore(NOW, 5),
          completedSetTimes: [],
          completedExerciseCount: 0,
        }),
        NOW,
      );
      expect(result.state).toBe('active');
    });

    it('measures idle time from the start and becomes stale once it has been open a long time', () => {
      const result = assessUnfinishedWorkout(
        workout({
          performedAt: minutesBefore(NOW, 300),
          completedSetTimes: [],
          plannedBlankSetCount: 2,
          completedExerciseCount: 0,
        }),
        NOW,
      );
      expect(result.state).toBe('stale');
      expect(result.lastActivityAt).toBe(minutesBefore(NOW, 300));
    });

    it('offers no suggested end time, since nothing was completed', () => {
      const result = assessUnfinishedWorkout(
        workout({ completedSetTimes: [], completedExerciseCount: 0 }),
        NOW,
      );
      expect(result.suggestedEndAt).toBeNull();
      expect(result.suggestedDurationMinutes).toBeNull();
    });
  });

  describe('suggested end time and duration', () => {
    it('suggests the last completed set as the end, not the current time', () => {
      const lastSet = minutesBefore(NOW, 200);
      const result = assessUnfinishedWorkout(
        promptable(200, { completedSetTimes: [minutesBefore(NOW, 220), lastSet] }),
        NOW,
      );
      expect(result.suggestedEndAt).toBe(lastSet);
    });

    it('derives the suggested duration from performedAt to the last completed set', () => {
      const performedAt = minutesBefore(NOW, 200);
      const lastSet = minutesBefore(NOW, 140); // 60 minutes after start
      const result = assessUnfinishedWorkout(
        promptable(140, {
          performedAt,
          completedSetTimes: [minutesBefore(NOW, 150), lastSet],
        }),
        NOW,
      );
      expect(result.suggestedDurationMinutes).toBe(60);
    });

    it('caps the suggested end at now when a set timestamp is in the future (device clock skew)', () => {
      const future = new Date(NOW.getTime() + 10 * MIN).toISOString();
      const result = assessUnfinishedWorkout(
        promptable(0, {
          completedSetTimes: [minutesBefore(NOW, 20), minutesBefore(NOW, 10), future],
        }),
        NOW,
      );
      expect(result.suggestedEndAt).toBe(NOW.toISOString());
    });

    it('reports null duration when the suggested end is not after the start', () => {
      const performedAt = minutesBefore(NOW, 10);
      const result = assessUnfinishedWorkout(
        workout({
          performedAt,
          completedSetTimes: [minutesBefore(NOW, 10)],
        }),
        NOW,
      );
      expect(result.suggestedDurationMinutes).toBeNull();
    });
  });

  describe('incomplete sets', () => {
    it('reports planned blank sets without changing the state', () => {
      const withBlanks = assessUnfinishedWorkout(promptable(200, { plannedBlankSetCount: 2 }), NOW);
      const withoutBlanks = assessUnfinishedWorkout(promptable(200), NOW);
      expect(withBlanks.plannedBlankSetCount).toBe(2);
      expect(withBlanks.state).toBe(withoutBlanks.state);
    });

    it('excludes blank sets from completed counts and the suggested end', () => {
      const result = assessUnfinishedWorkout(promptable(200, { plannedBlankSetCount: 3 }), NOW);
      expect(result.completedSetCount).toBe(3);
      expect(result.suggestedEndAt).toBe(minutesBefore(NOW, 200));
    });
  });

  describe('robustness', () => {
    it('is deterministic for the same rows and time', () => {
      const input = promptable(200);
      expect(assessUnfinishedWorkout(input, NOW)).toEqual(assessUnfinishedWorkout(input, NOW));
    });

    it('uses the latest completed set regardless of input order', () => {
      const newest = minutesBefore(NOW, 200);
      const result = assessUnfinishedWorkout(
        promptable(200, {
          completedSetTimes: [newest, minutesBefore(NOW, 400), minutesBefore(NOW, 300)],
        }),
        NOW,
      );
      expect(result.lastActivityAt).toBe(newest);
    });

    it('treats an unparseable timestamp as zero idle time rather than NaN', () => {
      const result = assessUnfinishedWorkout(
        workout({ performedAt: 'not-a-date', completedSetTimes: [] }),
        NOW,
      );
      expect(Number.isNaN(result.idleMinutes)).toBe(false);
      expect(result.state).toBe('active');
    });
  });
});

describe('toUnfinishedWorkoutInput', () => {
  it('splits completed and unfilled sets and counts completed exercises', () => {
    const input = toUnfinishedWorkoutInput({
      performedAt: '2026-10-04T10:00:00.000Z',
      exercises: [
        {
          sets: [{ completedAt: '2026-10-04T10:10:00.000Z' }, { completedAt: null }],
        },
        { sets: [{ completedAt: null }] },
        { sets: [{ completedAt: '2026-10-04T10:30:00.000Z' }] },
      ],
    });

    expect(input).toEqual({
      performedAt: '2026-10-04T10:00:00.000Z',
      completedSetTimes: ['2026-10-04T10:10:00.000Z', '2026-10-04T10:30:00.000Z'],
      plannedBlankSetCount: 2,
      exerciseCount: 3,
      completedExerciseCount: 2,
    });
  });

  it('handles a workout with no exercises', () => {
    expect(toUnfinishedWorkoutInput({ performedAt: 'x', exercises: [] })).toEqual({
      performedAt: 'x',
      completedSetTimes: [],
      plannedBlankSetCount: 0,
      exerciseCount: 0,
      completedExerciseCount: 0,
    });
  });
});
