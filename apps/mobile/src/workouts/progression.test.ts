import {
  allTimeBest,
  defaultRepRange,
  effectiveRepRange,
  findWeightedVariant,
  formatRepRange,
  lastTimeFlags,
  progressionForExercise,
  thisSessionCue,
  topSetOf,
} from './progression';
import type { SetRecord } from './workoutQueries';

const DONE = '2026-10-18T10:00:00.000Z';
const LB = 0.45359237;
let nextId = 0;

function set(extra: Partial<SetRecord>): SetRecord {
  nextId += 1;
  return {
    id: `s${nextId}`,
    setIndex: nextId,
    side: null,
    weightKg: null,
    reps: null,
    durationSeconds: null,
    completedAt: DONE,
    ...extra,
  };
}

/** Sets at the given pound weights and reps, in order. */
function lifts(...pairs: [number, number][]): SetRecord[] {
  return pairs.map(([lb, reps], i) => set({ setIndex: i + 1, weightKg: lb * LB, reps }));
}

const weighted = {
  measurementType: 'weight_reps' as const,
  movementType: 'bilateral' as const,
  range: { min: 8, max: 12 },
  unit: 'lb' as const,
};

describe('the starting range and guidance', () => {
  it('starts people still learning at 8-12, and experienced ones at 5-10', () => {
    expect(defaultRepRange('still_learning')).toEqual({ min: 8, max: 12 });
    expect(defaultRepRange('knows_basics')).toEqual({ min: 8, max: 12 });
    expect(defaultRepRange('plans_and_progresses')).toEqual({ min: 5, max: 10 });
    expect(defaultRepRange('follows_method')).toEqual({ min: 5, max: 10 });
    expect(defaultRepRange(null)).toEqual({ min: 8, max: 12 });
  });

  it('shows a range as "8–12"', () => {
    expect(formatRepRange({ min: 8, max: 12 })).toBe('8–12');
  });
});

describe('the top set', () => {
  it('is the heaviest completed set, the first one if several tie', () => {
    const sets = lifts([50, 12], [55, 9], [55, 8]);
    expect(topSetOf(sets, 'weight_reps', 'bilateral')?.reps).toBe(9);
  });

  it('ignores sets not completed', () => {
    const sets = [...lifts([50, 10]), set({ weightKg: 100, reps: 12, completedAt: null })];
    expect(topSetOf(sets, 'weight_reps', 'bilateral')?.reps).toBe(10);
  });

  it('needs both sides of a unilateral exercise, taking the lower reps', () => {
    const sets = [
      set({ side: 'left', weightKg: 20, reps: 12 }),
      set({ side: 'right', weightKg: 20, reps: 11 }),
    ];
    expect(topSetOf(sets, 'weight_reps', 'unilateral')).toMatchObject({ weightKg: 20, reps: 11 });
    expect(topSetOf([sets[0]!], 'weight_reps', 'unilateral')).toBeNull();
  });
});

describe("next time, on last time's sets", () => {
  it('says to go up on each set that reached the top of the range, or beyond, by 5 lb', () => {
    expect(
      lastTimeFlags({ ...weighted, lastSessionSets: lifts([50, 12], [50, 10], [45, 14]) }),
    ).toEqual({ 1: 'Hit 12! Go up to 55 lb today.', 3: 'Hit 14! Go up to 50 lb today.' });
  });

  it('says nothing about a set short of the top -- there is no increment to recommend yet', () => {
    expect(lastTimeFlags({ ...weighted, lastSessionSets: lifts([60, 7], [60, 11]) })).toEqual({});
  });

  it('only counts completed sets', () => {
    expect(
      lastTimeFlags({
        ...weighted,
        lastSessionSets: [set({ weightKg: 50 * LB, reps: 12, completedAt: null })],
      }),
    ).toEqual({});
  });

  it('follows the range: 5-10 makes 10 the top', () => {
    expect(
      lastTimeFlags({ ...weighted, range: { min: 5, max: 10 }, lastSessionSets: lifts([50, 10]) }),
    ).toEqual({ 1: 'Hit 10! Go up to 55 lb today.' });
  });

  it('shows kilograms for a kg user, up 2.5 kg', () => {
    expect(
      lastTimeFlags({
        ...weighted,
        unit: 'kg',
        lastSessionSets: [set({ weightKg: 100, reps: 12 })],
      }),
    ).toEqual({ 1: 'Hit 12! Go up to 102.5 kg today.' });
  });

  it('says to make a bodyweight exercise harder: the weighted version, or a rep more', () => {
    const base = { ...weighted, measurementType: 'bodyweight' as const };
    expect(
      lastTimeFlags({
        ...base,
        weightedVariant: 'Weighted Pull-Up',
        lastSessionSets: [set({ reps: 12 })],
      }),
    ).toEqual({ 1: 'Hit 12! Try Weighted Pull-Up today.' });
    expect(lastTimeFlags({ ...base, lastSessionSets: [set({ reps: 13 })] })).toEqual({
      1: 'Hit 13! Go for 14 today.',
    });
  });

  it('says nothing for a timed exercise, which has no range', () => {
    expect(
      lastTimeFlags({
        ...weighted,
        measurementType: 'timed',
        lastSessionSets: [set({ durationSeconds: 90 })],
      }),
    ).toEqual({});
  });
});

describe('in the workout itself', () => {
  it('says so once the top set reaches the top of the range', () => {
    expect(thisSessionCue({ ...weighted, sets: lifts([50, 10], [50, 12]) })).toBeNull();
    expect(thisSessionCue({ ...weighted, sets: lifts([55, 12], [50, 12]) })).toBe(
      'Top of your range. Increase the weight next time.',
    );
  });

  it('only counts completed sets', () => {
    expect(
      thisSessionCue({ ...weighted, sets: [set({ weightKg: 30, reps: 12, completedAt: null })] }),
    ).toBeNull();
  });

  it('offers ways to make a bodyweight exercise harder', () => {
    expect(
      thisSessionCue({
        ...weighted,
        measurementType: 'bodyweight',
        weightedVariant: 'Weighted Pull-Up',
        sets: [set({ reps: 12 })],
      }),
    ).toBe('Top of your range. Next time, add reps or try Weighted Pull-Up.');
    expect(
      thisSessionCue({ ...weighted, measurementType: 'bodyweight', sets: [set({ reps: 13 })] }),
    ).toBe('Top of your range. Next time, go for more reps.');
  });

  it('notices a new time on a timed exercise', () => {
    const timed = { ...weighted, measurementType: 'timed' as const };
    const last = [set({ durationSeconds: 60 })];
    expect(
      thisSessionCue({ ...timed, sets: [set({ durationSeconds: 65 })], lastSessionSets: last }),
    ).toBe('A new time: longer than last time.');
    expect(
      thisSessionCue({ ...timed, sets: [set({ durationSeconds: 55 })], lastSessionSets: last }),
    ).toBeNull();
    expect(thisSessionCue({ ...timed, sets: [set({ durationSeconds: 65 })] })).toBeNull();
  });
});

describe('allTimeBest', () => {
  const OLD = '2026-09-02T10:00:00.000Z';
  const pr = (reps: number, lb: number, id = `pr-${reps}`) => ({
    reps,
    bestWeightKg: lb * LB,
    achievedAt: OLD,
    sourceSetId: id,
  });
  const weightedBest = {
    measurementType: 'weight_reps' as const,
    range: { min: 8, max: 12 },
    record: null,
    todaySets: [] as SetRecord[],
  };

  it('is the heaviest set within the rep range, with when it was set', () => {
    const best = allTimeBest({
      ...weightedBest,
      repPRs: [pr(5, 80), pr(8, 60), pr(10, 60), pr(12, 50)],
    });
    expect(best?.weightKg).toBeCloseTo(60 * LB);
    expect(best?.reps).toBe(10);
    expect(best?.achievedAt).toBe(OLD);
  });

  it('falls back to the heaviest set at any rep count with nothing in the range', () => {
    const best = allTimeBest({ ...weightedBest, repPRs: [pr(5, 80), pr(3, 85)] });
    expect(best?.weightKg).toBeCloseTo(85 * LB);
    expect(best?.reps).toBe(3);
  });

  it("takes one of today's completed sets only when it beats the record", () => {
    const tie = allTimeBest({
      ...weightedBest,
      repPRs: [pr(10, 60)],
      todaySets: lifts([60, 10]),
    });
    expect(tie?.achievedAt).toBe(OLD);

    const beaten = allTimeBest({
      ...weightedBest,
      repPRs: [pr(10, 60)],
      todaySets: [...lifts([65, 9]), set({ weightKg: 90 * LB, reps: 9, completedAt: null })],
    });
    // 90 lb isn't completed, so it doesn't count.
    expect(beaten?.weightKg).toBeCloseTo(65 * LB);
    expect(beaten?.achievedAt).toBeNull();
  });

  it("says a record set today is today's", () => {
    const today = lifts([70, 8]);
    const best = allTimeBest({
      ...weightedBest,
      repPRs: [pr(8, 70, today[0].id)],
      todaySets: today,
    });
    expect(best?.achievedAt).toBeNull();
  });

  it('is the most reps or the longest time for bodyweight and timed exercises', () => {
    const base = { range: { min: 8, max: 12 }, repPRs: [], todaySets: [] as SetRecord[] };
    expect(
      allTimeBest({
        ...base,
        measurementType: 'bodyweight',
        record: { value: 25, achievedAt: OLD, sourceSetId: 'r' },
      }),
    ).toEqual({
      measurementType: 'bodyweight',
      weightKg: null,
      reps: 25,
      durationSeconds: null,
      achievedAt: OLD,
    });
    expect(
      allTimeBest({
        ...base,
        measurementType: 'timed',
        record: { value: 105, achievedAt: OLD, sourceSetId: 'r' },
        todaySets: [set({ durationSeconds: 120 })],
      }),
    ).toMatchObject({ durationSeconds: 120, achievedAt: null });
    expect(allTimeBest({ ...base, measurementType: 'timed', record: null })).toBeNull();
  });
});

describe('the weighted version', () => {
  const library = [
    { name: 'Pull-Up', measurementType: 'bodyweight' as const, isActive: true },
    { name: 'Weighted Pull-Up', measurementType: 'weight_reps' as const, isActive: true },
    { name: 'Weighted Dip', measurementType: 'weight_reps' as const, isActive: false },
  ];

  it('is the active weighted exercise named after it', () => {
    expect(findWeightedVariant('Pull-Up', library)).toBe('Weighted Pull-Up');
    expect(findWeightedVariant('pull-up', library)).toBe('Weighted Pull-Up');
  });

  it('is nothing when there is none, or it was deleted', () => {
    expect(findWeightedVariant('Push-Up', library)).toBeNull();
    expect(findWeightedVariant('Dip', library)).toBeNull();
  });
});

describe('progressionForExercise', () => {
  const exercise = {
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    movementType: 'bilateral' as const,
    measurementType: 'weight_reps' as const,
    sets: lifts([50, 12]),
  };
  const base = {
    exercise,
    lastSessionSets: lifts([50, 12]),
    settings: { range: { min: 8, max: 12 }, enabled: true, unit: 'lb' as const },
    repPRs: [
      {
        exerciseId: 'bench',
        reps: 10,
        bestWeightKg: 55 * LB,
        achievedAt: '2026-09-02T10:00:00.000Z',
        sourceSetId: 'pr-bench',
      },
      {
        exerciseId: 'squat',
        reps: 10,
        bestWeightKg: 200 * LB,
        achievedAt: '2026-09-02T10:00:00.000Z',
        sourceSetId: 'pr-squat',
      },
    ],
    records: [],
    library: [],
  };

  it("gives the card its all-time best, last time's messages and today's own cue", () => {
    expect(progressionForExercise(base)).toEqual({
      allTimeBest: {
        measurementType: 'weight_reps',
        weightKg: 55 * LB,
        reps: 10,
        durationSeconds: null,
        achievedAt: '2026-09-02T10:00:00.000Z',
      },
      lastTimeFlags: { 1: 'Hit 12! Go up to 55 lb today.' },
      sessionCue: 'Top of your range. Increase the weight next time.',
    });
  });

  it('keeps the all-time best, a record, when suggestions are off', () => {
    const result = progressionForExercise({
      ...base,
      settings: { ...base.settings, enabled: false },
    });
    expect(result.allTimeBest?.reps).toBe(10);
    expect(result.lastTimeFlags).toEqual({});
    expect(result.sessionCue).toBeNull();
  });

  it('has no messages without a last session', () => {
    expect(progressionForExercise({ ...base, lastSessionSets: undefined }).lastTimeFlags).toEqual(
      {},
    );
  });
});

describe('exercise-specific ranges and steps', () => {
  it('shows a range of one number as that number', () => {
    expect(formatRepRange({ min: 5, max: 5 })).toBe('5');
    expect(formatRepRange({ min: 8, max: 12 })).toBe('8–12');
  });

  it("uses an exercise's own range over the person's", () => {
    expect(effectiveRepRange({ min: 8, max: 12 }, { min: 3, max: 5 })).toEqual({ min: 3, max: 5 });
    expect(effectiveRepRange({ min: 8, max: 12 }, null)).toEqual({ min: 8, max: 12 });
  });

  it("goes heavier by the exercise's own step when it has one", () => {
    expect(
      lastTimeFlags({
        ...weighted,
        incrementKg: 1.25,
        unit: 'kg',
        lastSessionSets: [set({ weightKg: 60, reps: 12 })],
      }),
    ).toEqual({ 1: 'Hit 12! Go up to 61.25 kg today.' });
  });

  it("judges against the exercise's own range, top included, in the live workout", () => {
    const result = progressionForExercise({
      exercise: {
        exerciseId: 'ex-1',
        exerciseName: 'Deadlift',
        movementType: 'bilateral',
        measurementType: 'weight_reps',
        sets: [],
      },
      lastSessionSets: [
        {
          id: 's1',
          setIndex: 1,
          weightKg: 140,
          reps: 5,
          completedAt: '2026-01-01T00:00:00Z',
        } as SetRecord,
      ],
      settings: { range: { min: 8, max: 12 }, enabled: true, unit: 'kg' },
      repPRs: [],
      records: [],
      library: [],
      override: { range: { min: 3, max: 5 }, incrementKg: 5 },
    });
    expect(result.lastTimeFlags).toEqual({ 1: 'Hit 5! Go up to 145 kg today.' });
  });
});
