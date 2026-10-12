import { withPrefilledSets } from './setInputDrafts';
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
