import {
  bestLine,
  cuesEqual,
  defaultRepRange,
  findWeightedVariant,
  formatRepRange,
  nextSessionCue,
  progressionForExercise,
  thisSessionCue,
  topSetOf,
  wantsGuidance,
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

  it('explains suggestions only to people who asked for guidance', () => {
    expect(wantsGuidance('still_learning')).toBe(true);
    expect(wantsGuidance('knows_basics')).toBe(true);
    expect(wantsGuidance('plans_and_progresses')).toBe(false);
    expect(wantsGuidance(null)).toBe(false);
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

describe('next time, for a weighted exercise', () => {
  it('says to increase the weight once the top set reaches the top of the range', () => {
    const cue = nextSessionCue({
      ...weighted,
      guided: false,
      lastSessionSets: lifts([50, 12], [50, 10]),
    });
    expect(cue).toEqual({
      headline: 'Your top set hit 12 at 50 lb. Increase the weight today.',
      options: [],
      detail: null,
    });
  });

  it('counts going past the top too', () => {
    const cue = nextSessionCue({ ...weighted, guided: false, lastSessionSets: lifts([50, 14]) });
    expect(cue?.headline).toBe('Your top set hit 14 at 50 lb. Increase the weight today.');
  });

  it('tells someone who wants guidance how to pick the new weight', () => {
    const cue = nextSessionCue({ ...weighted, guided: true, lastSessionSets: lifts([50, 12]) });
    expect(cue?.detail).toBe(
      'Pick a weight you can lift for about 8 reps, then build back up to 12.',
    );
  });

  it('says to keep the weight and work toward the top, even below the bottom of the range', () => {
    expect(
      nextSessionCue({ ...weighted, guided: false, lastSessionSets: lifts([55, 10]) })?.headline,
    ).toBe('Last time: 10 at 55 lb. Keep 55 lb and work toward 12.');
    const belowRange = nextSessionCue({
      ...weighted,
      guided: true,
      lastSessionSets: lifts([60, 7]),
    });
    expect(belowRange?.headline).toBe('Last time: 7 at 60 lb. Keep 60 lb and work toward 12.');
    expect(belowRange?.detail).toBe("When your top set reaches 12, it's time to go heavier.");
    // Never "lighter", never a bad set.
    expect(JSON.stringify(belowRange)).not.toMatch(/lighter|under|below|bad/i);
  });

  it('judges the top set, not a lighter set that happened to reach the top', () => {
    const cue = nextSessionCue({
      ...weighted,
      guided: false,
      lastSessionSets: lifts([45, 15], [55, 9]),
    });
    expect(cue?.headline).toBe('Last time: 9 at 55 lb. Keep 55 lb and work toward 12.');
  });

  it('follows the range: 5-10 makes 10 the top', () => {
    const cue = nextSessionCue({
      ...weighted,
      range: { min: 5, max: 10 },
      guided: true,
      lastSessionSets: lifts([100, 10]),
    });
    expect(cue?.headline).toBe('Your top set hit 10 at 100 lb. Increase the weight today.');
    expect(cue?.detail).toBe(
      'Pick a weight you can lift for about 5 reps, then build back up to 10.',
    );
  });

  it('needs both sides of a unilateral exercise at the top', () => {
    const both = nextSessionCue({
      ...weighted,
      movementType: 'unilateral',
      guided: false,
      lastSessionSets: [
        set({ side: 'left', weightKg: 25 * LB, reps: 12 }),
        set({ side: 'right', weightKg: 25 * LB, reps: 12 }),
      ],
    });
    expect(both?.headline).toBe(
      'Your top set hit 12 on both sides at 25 lb. Increase the weight today.',
    );
    const oneSide = nextSessionCue({
      ...weighted,
      movementType: 'unilateral',
      guided: false,
      lastSessionSets: [
        set({ side: 'left', weightKg: 25 * LB, reps: 12 }),
        set({ side: 'right', weightKg: 25 * LB, reps: 10 }),
      ],
    });
    expect(oneSide?.headline).toBe('Last time: 10 at 25 lb. Keep 25 lb and work toward 12.');
  });

  it('shows kilograms for a kg user', () => {
    const cue = nextSessionCue({
      ...weighted,
      unit: 'kg',
      guided: false,
      lastSessionSets: [set({ weightKg: 60, reps: 12 })],
    });
    expect(cue?.headline).toBe('Your top set hit 12 at 60 kg. Increase the weight today.');
  });

  it('says nothing without a logged set', () => {
    expect(nextSessionCue({ ...weighted, guided: false, lastSessionSets: [] })).toBeNull();
  });
});

describe('next time, for a bodyweight exercise', () => {
  const bodyweight = { ...weighted, measurementType: 'bodyweight' as const };

  it('offers more reps and the weighted version once the best set reaches the top', () => {
    const cue = nextSessionCue({
      ...bodyweight,
      guided: false,
      weightedVariant: 'Weighted Pull-Up',
      lastSessionSets: [set({ reps: 12 }), set({ reps: 9 })],
    });
    expect(cue).toEqual({
      headline: 'Your best set hit 12 reps, the top of your range. Make it harder today:',
      options: ['Add reps: go for 13 or more', 'Add weight: try Weighted Pull-Up'],
      detail: null,
    });
  });

  it('offers more reps alone when there is no weighted version', () => {
    const cue = nextSessionCue({
      ...bodyweight,
      guided: true,
      lastSessionSets: [set({ reps: 15 })],
    });
    expect(cue?.options).toEqual(['Add reps: go for 16 or more']);
    expect(cue?.detail).not.toBeNull();
  });

  it('says to work toward the top before then', () => {
    const cue = nextSessionCue({
      ...bodyweight,
      guided: false,
      lastSessionSets: [set({ reps: 9 })],
    });
    expect(cue?.headline).toBe('Last time: 9 reps. Work toward 12.');
    expect(cue?.options).toEqual([]);
  });
});

describe('next time, for a timed exercise', () => {
  const timed = { ...weighted, measurementType: 'timed' as const };

  it('asks for a new time: 5 seconds more under a minute', () => {
    const cue = nextSessionCue({
      ...timed,
      guided: false,
      lastSessionSets: [set({ durationSeconds: 45 }), set({ durationSeconds: 40 })],
    });
    expect(cue).toEqual({
      headline: 'Last time: 0:45. Go for a new time today.',
      options: ['Aim for 0:50 or more'],
      detail: null,
    });
  });

  it('10 seconds more from a minute up, and the weighted version when there is one', () => {
    const cue = nextSessionCue({
      ...timed,
      guided: true,
      weightedVariant: 'Weighted Plank',
      lastSessionSets: [set({ durationSeconds: 90 })],
    });
    expect(cue?.options).toEqual(['Aim for 1:40 or more', 'Or add weight: try Weighted Plank']);
    expect(cue?.detail).toMatch(/longer each time/);
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

describe('the best within the range', () => {
  it('is the heaviest rep-count PR inside the range', () => {
    expect(
      bestLine({
        measurementType: 'weight_reps',
        range: { min: 8, max: 12 },
        unit: 'lb',
        repPRs: [
          { reps: 5, bestWeightKg: 80 * LB },
          { reps: 8, bestWeightKg: 60 * LB },
          { reps: 10, bestWeightKg: 60 * LB },
          { reps: 12, bestWeightKg: 50 * LB },
        ],
        recordValue: null,
      }),
    ).toBe('Best at 8–12: 60 lb × 10');
  });

  it('is nothing when no PR is inside the range', () => {
    expect(
      bestLine({
        measurementType: 'weight_reps',
        range: { min: 8, max: 12 },
        unit: 'lb',
        repPRs: [{ reps: 5, bestWeightKg: 80 }],
        recordValue: null,
      }),
    ).toBeNull();
  });

  it('is the most reps or the longest time for bodyweight and timed exercises', () => {
    const base = { range: { min: 8, max: 12 }, unit: 'lb' as const, repPRs: [] };
    expect(bestLine({ ...base, measurementType: 'bodyweight', recordValue: 25 })).toBe(
      'Most reps: 25',
    );
    expect(bestLine({ ...base, measurementType: 'timed', recordValue: 105 })).toBe('Longest: 1:45');
    expect(bestLine({ ...base, measurementType: 'timed', recordValue: null })).toBeNull();
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

describe('cuesEqual', () => {
  it('compares cues by value', () => {
    const a = { headline: 'x', options: ['a'], detail: null };
    expect(cuesEqual(a, { ...a, options: ['a'] })).toBe(true);
    expect(cuesEqual(a, { ...a, options: ['b'] })).toBe(false);
    expect(cuesEqual(null, null)).toBe(true);
    expect(cuesEqual(a, null)).toBe(false);
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
    settings: { range: { min: 8, max: 12 }, enabled: true, guided: false, unit: 'lb' as const },
    repPRs: [
      { exerciseId: 'bench', reps: 10, bestWeightKg: 55 * LB },
      { exerciseId: 'squat', reps: 10, bestWeightKg: 200 * LB },
    ],
    records: [],
    library: [],
  };

  it("gives the card its best line, today's aim and today's own cue", () => {
    expect(progressionForExercise(base)).toEqual({
      bestLine: 'Best at 8–12: 55 lb × 10',
      progressionCue: {
        headline: 'Your top set hit 12 at 50 lb. Increase the weight today.',
        options: [],
        detail: null,
      },
      sessionCue: 'Top of your range. Increase the weight next time.',
    });
  });

  it('keeps the best line, a record, when suggestions are off', () => {
    const result = progressionForExercise({
      ...base,
      settings: { ...base.settings, enabled: false },
    });
    expect(result.bestLine).toBe('Best at 8–12: 55 lb × 10');
    expect(result.progressionCue).toBeNull();
    expect(result.sessionCue).toBeNull();
  });

  it('has no aim for today without a last session', () => {
    expect(
      progressionForExercise({ ...base, lastSessionSets: undefined }).progressionCue,
    ).toBeNull();
  });
});
