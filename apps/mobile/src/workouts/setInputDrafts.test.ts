import {
  buildPreviousSessionDisplay,
  computeCardSets,
  draftFromSet,
  draftValues,
  invalidDraftMessage,
  isValidDraft,
} from './setInputDrafts';
import type { SetRecord } from './workoutQueries';

function set(id: string, setIndex: number, extra: Partial<SetRecord> = {}): SetRecord {
  return { id, setIndex, weightKg: null, reps: null, completedAt: null, side: null, ...extra };
}

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

  it("names last session's top set, and which set it was", () => {
    const done = '2026-10-01T10:00:00.000Z';
    const display = buildPreviousSessionDisplay(
      {
        performedAt: done,
        sets: [
          set('p1', 1, { weightKg: 60, reps: 10, completedAt: done }),
          set('p2', 2, { weightKg: 65, reps: 8, completedAt: done }),
          set('p3', 3, { weightKg: 65, reps: 7, completedAt: done }),
        ],
      },
      'kg',
    );

    // The heaviest, the first one when two tie.
    expect(display).toMatchObject({ topSetDisplay: '65 kg × 8', topSetNumber: 2 });
  });
});
