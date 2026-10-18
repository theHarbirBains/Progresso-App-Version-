import {
  buildPreviousSessionDisplay,
  computeCardSets,
  draftFromSet,
  draftValues,
  invalidDraftMessage,
  isValidDraft,
  withPrefilledSets,
} from './setInputDrafts';
import type { SetRecord, SetSide } from './workoutQueries';

function set(id: string, setIndex: number, extra: Partial<SetRecord> = {}): SetRecord {
  return { id, setIndex, weightKg: null, reps: null, completedAt: null, side: null, ...extra };
}

/** One of last session's sets, as fetchPreviousPerformance returns them: completed. */
function logged(setIndex: number, weightKg: number, reps: number, side: SetSide = null): SetRecord {
  return set(`last-${setIndex}-${side ?? 'none'}`, setIndex, {
    weightKg,
    reps,
    side,
    completedAt: '2026-10-01T10:00:00.000Z',
  });
}

describe('withPrefilledSets', () => {
  it('copies the set before it, so after completing 100 kg x 8 the next set shows 100 and 8', () => {
    const done = set('s1', 1, { weightKg: 100, reps: 8, completedAt: '2026-10-11T10:00:00.000Z' });

    const inputs = withPrefilledSets(
      { s1: { weight: '100', reps: '8' } },
      [set('s2', 2)],
      [done],
      [logged(1, 90, 10), logged(2, 90, 10)],
      'kg',
    );

    expect(inputs.s2).toEqual({ weight: '100', reps: '8' });
  });

  it('copies what is typed in the set before it, even before that set is completed', () => {
    const inputs = withPrefilledSets(
      { s1: { weight: '102.5', reps: '6' } },
      [set('s2', 2)],
      [set('s1', 1)],
      undefined,
      'kg',
    );

    expect(inputs.s2).toEqual({ weight: '102.5', reps: '6' });
  });

  it("starts an exercise's first set from set 1 of last session", () => {
    const inputs = withPrefilledSets(
      {},
      [set('s1', 1)],
      [],
      [logged(1, 60, 8), logged(2, 65, 6)],
      'kg',
    );

    expect(inputs.s1).toEqual({ weight: '60', reps: '8' });
  });

  it('uses the same set number from last session when the set before it is empty', () => {
    const inputs = withPrefilledSets(
      { s1: { weight: '100', reps: '8' }, s2: { weight: '', reps: '' } },
      [set('s3', 3)],
      [set('s1', 1), set('s2', 2)],
      [logged(1, 100, 8), logged(2, 100, 7), logged(3, 95, 8)],
      'kg',
    );

    expect(inputs.s3).toEqual({ weight: '95', reps: '8' });
  });

  it('numbers last session by the sets it logged, so a skipped set leaves no gap', () => {
    // Set 2 was left blank last time, so only set indexes 1 and 3 were logged.
    const inputs = withPrefilledSets(
      {},
      [set('s2', 2)],
      [set('s1', 1)],
      [logged(1, 100, 8), logged(3, 90, 10)],
      'kg',
    );

    expect(inputs.s2).toEqual({ weight: '90', reps: '10' });
  });

  it("shows last session's weight in the user's unit", () => {
    const inputs = withPrefilledSets({}, [set('s1', 1)], [], [logged(1, 102.06, 5)], 'lb');

    expect(inputs.s1).toEqual({ weight: '225', reps: '5' });
  });

  it('fills each side of a new unilateral set from the same side of the pair before it', () => {
    const inputs = withPrefilledSets(
      { l1: { weight: '20', reps: '12' }, r1: { weight: '22.5', reps: '10' } },
      [set('l2', 2, { side: 'left' }), set('r2', 2, { side: 'right' })],
      [set('l1', 1, { side: 'left' }), set('r1', 1, { side: 'right' })],
      undefined,
      'kg',
    );

    expect(inputs.l2).toEqual({ weight: '20', reps: '12' });
    expect(inputs.r2).toEqual({ weight: '22.5', reps: '10' });
  });

  it('counts a left/right pair as one set when matching last session', () => {
    const inputs = withPrefilledSets(
      {},
      [set('l2', 2, { side: 'left' }), set('r2', 2, { side: 'right' })],
      [set('l1', 1, { side: 'left' }), set('r1', 1, { side: 'right' })],
      [
        logged(1, 20, 12, 'left'),
        logged(1, 22.5, 10, 'right'),
        logged(2, 17.5, 15, 'left'),
        logged(2, 20, 12, 'right'),
      ],
      'kg',
    );

    expect(inputs.l2).toEqual({ weight: '17.5', reps: '15' });
    expect(inputs.r2).toEqual({ weight: '20', reps: '12' });
  });

  it('leaves a new set empty when there is nothing to copy', () => {
    const noMatch = withPrefilledSets(
      {},
      [set('s3', 3)],
      [set('s1', 1), set('s2', 2)],
      [logged(1, 100, 8)],
      'kg',
    );
    const noHistory = withPrefilledSets({}, [set('s1', 1)], [], undefined, 'kg');

    expect(noMatch.s3).toEqual({ weight: '', reps: '' });
    expect(noHistory.s1).toEqual({ weight: '', reps: '' });
  });

  it('keeps anything already typed into the new set', () => {
    const inputs = withPrefilledSets(
      { s1: { weight: '70', reps: '' } },
      [set('s1', 1)],
      [],
      [logged(1, 60, 8)],
      'kg',
    );

    expect(inputs.s1).toEqual({ weight: '70', reps: '' });
  });

  it('only adds the new sets, leaving every other input as it was', () => {
    const before = { s1: { weight: '100', reps: '8' }, other: { weight: '40', reps: '12' } };

    const inputs = withPrefilledSets(before, [set('s2', 2)], [set('s1', 1)], undefined, 'kg');

    expect(inputs).toEqual({ ...before, s2: { weight: '100', reps: '8' } });
    expect(before).not.toHaveProperty('s2');
  });
});

describe('bodyweight and timed sets', () => {
  it('completes a bodyweight set on reps alone, and a timed one on a time', () => {
    expect(isValidDraft({ weight: '', reps: '20' }, 'bodyweight')).toBe(true);
    expect(isValidDraft({ weight: '', reps: '' }, 'bodyweight')).toBe(false);
    expect(isValidDraft({ weight: '', reps: '2.5' }, 'bodyweight')).toBe(false);

    expect(isValidDraft({ weight: '', reps: '', duration: '45' }, 'timed')).toBe(true);
    expect(isValidDraft({ weight: '', reps: '', duration: '1:30' }, 'timed')).toBe(true);
    expect(isValidDraft({ weight: '', reps: '', duration: '1:75' }, 'timed')).toBe(false);
    expect(isValidDraft({ weight: '100', reps: '8' }, 'timed')).toBe(false);
  });

  it('still needs a weight and reps for a weighted set', () => {
    expect(isValidDraft({ weight: '', reps: '20' }, 'weight_reps')).toBe(false);
    expect(isValidDraft({ weight: '', reps: '20' })).toBe(false);
  });

  it('saves only what the type records', () => {
    expect(draftValues({ weight: '50', reps: '20' }, 'bodyweight', 'kg')).toEqual({
      weightKg: null,
      reps: 20,
      durationSeconds: null,
    });
    expect(draftValues({ weight: '', reps: '9', duration: '1:30' }, 'timed', 'kg')).toEqual({
      weightKg: null,
      reps: null,
      durationSeconds: 90,
    });
    expect(draftValues({ weight: '100', reps: '5' }, 'weight_reps', 'kg')).toEqual({
      weightKg: 100,
      reps: 5,
      durationSeconds: null,
    });
  });

  it('shows a saved set back in its fields', () => {
    expect(
      draftFromSet({ weightKg: null, reps: null, durationSeconds: 90 }, 'timed', 'kg'),
    ).toEqual({ weight: '', reps: '', duration: '1:30' });
    expect(
      draftFromSet({ weightKg: 80, reps: 20, durationSeconds: null }, 'bodyweight', 'kg'),
    ).toEqual({ weight: '', reps: '20' });
  });

  it('says what a set is missing, by its type', () => {
    expect(invalidDraftMessage('bodyweight')).toBe('Enter a rep count');
    expect(invalidDraftMessage('timed', true)).toBe('Enter a time for both sides, like 45 or 1:30');
  });

  it("gates a card's sets on its type", () => {
    const cardSets = computeCardSets(
      [set('s1', 1), set('s2', 2)],
      { s1: { weight: '', reps: '', duration: '0:45' }, s2: { weight: '', reps: '12' } },
      'timed',
    );

    expect(cardSets.map((s) => s.canComplete)).toEqual([true, false]);
    expect(cardSets[0]?.duration).toBe('0:45');
  });

  it("shows last session's times for a timed exercise", () => {
    const display = buildPreviousSessionDisplay(
      {
        performedAt: '2026-10-01T10:00:00.000Z',
        sets: [set('p1', 1, { durationSeconds: 75, completedAt: '2026-10-01T10:00:00.000Z' })],
      },
      'kg',
      'timed',
    );

    expect(display?.sets[0]).toMatchObject({ setNumber: 1, durationDisplay: '1:15' });
  });

  it("fills a new timed set from last session's time", () => {
    const inputs = withPrefilledSets(
      {},
      [set('s1', 1)],
      [],
      [set('last-1', 1, { durationSeconds: 60, completedAt: '2026-10-01T10:00:00.000Z' })],
      'kg',
      'timed',
    );

    expect(inputs.s1).toEqual({ weight: '', reps: '', duration: '1:00' });
  });
});
