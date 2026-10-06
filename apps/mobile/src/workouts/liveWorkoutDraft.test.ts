import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  clearLiveWorkoutDraft,
  loadLiveWorkoutDraft,
  mergeLiveWorkoutDrafts,
  pendingDraftsFor,
  saveLiveWorkoutDraft,
} from './liveWorkoutDraft';

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('mergeLiveWorkoutDrafts', () => {
  it('puts a typed value over the saved one for a set that is still open', () => {
    const merged = mergeLiveWorkoutDrafts(
      { s1: { weight: '100', reps: '5' } },
      { s1: { weight: '102.5', reps: '5' } },
      new Set(['s1']),
    );
    expect(merged.s1).toEqual({ weight: '102.5', reps: '5' });
  });

  it('keeps the saved values for a completed set, since it was written to the server', () => {
    const merged = mergeLiveWorkoutDrafts(
      { s1: { weight: '100', reps: '5' } },
      { s1: { weight: '999', reps: '1' } },
      new Set<string>(),
    );
    expect(merged.s1).toEqual({ weight: '100', reps: '5' });
  });

  it('ignores an empty draft rather than blanking a saved value', () => {
    const merged = mergeLiveWorkoutDrafts(
      { s1: { weight: '100', reps: '5' } },
      { s1: { weight: '', reps: '' } },
      new Set(['s1']),
    );
    expect(merged.s1).toEqual({ weight: '100', reps: '5' });
  });
});

describe('pendingDraftsFor', () => {
  it('keeps only open sets that have something typed in them', () => {
    const pending = pendingDraftsFor(
      {
        open: { weight: '50', reps: '' },
        empty: { weight: '', reps: '' },
        done: { weight: '80', reps: '8' },
      },
      new Set(['open', 'empty']),
    );
    expect(pending).toEqual({ open: { weight: '50', reps: '' } });
  });
});

describe('storage', () => {
  it('saves drafts for one workout and loads them back', async () => {
    await saveLiveWorkoutDraft('w1', { s1: { weight: '60', reps: '10' } });
    expect(await loadLiveWorkoutDraft('w1')).toEqual({ s1: { weight: '60', reps: '10' } });
  });

  it("keeps each workout's drafts separate", async () => {
    await saveLiveWorkoutDraft('w1', { s1: { weight: '60', reps: '10' } });
    expect(await loadLiveWorkoutDraft('w2')).toEqual({});
  });

  it("clears a workout's drafts once it is finished or cancelled", async () => {
    await saveLiveWorkoutDraft('w1', { s1: { weight: '60', reps: '10' } });
    await clearLiveWorkoutDraft('w1');
    expect(await loadLiveWorkoutDraft('w1')).toEqual({});
  });

  it('treats corrupt stored data as no drafts, rather than failing the workout', async () => {
    await AsyncStorage.setItem('@progresso/liveWorkoutDraft/w1', '{not json');
    expect(await loadLiveWorkoutDraft('w1')).toEqual({});
  });

  it('never throws when storage itself fails, since the draft is only a convenience', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
    await expect(saveLiveWorkoutDraft('w1', {})).resolves.toBeUndefined();
    jest.restoreAllMocks();
  });
});
