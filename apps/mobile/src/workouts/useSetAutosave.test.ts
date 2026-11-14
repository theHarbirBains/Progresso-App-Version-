import { Alert } from 'react-native';
import {
  askAboutEmptySets,
  setIdsToRemove,
  setSaveFor,
  unfilledSets,
  type LiveSet,
} from './useSetAutosave';
import type { SetRecord } from './workoutQueries';

const open = (id: string, setIndex = 1, side: SetRecord['side'] = null): SetRecord => ({
  id,
  setIndex,
  side,
  weightKg: null,
  reps: null,
  completedAt: null,
});
const NOW = () => '2026-11-13T18:00:00.000Z';

describe('what a typed set saves', () => {
  it('saves a set as done once its values are whole, at the moment they are', () => {
    expect(setSaveFor(open('s1'), { weight: '100', reps: '8' }, 'weight_reps', 'kg', NOW)).toEqual({
      weightKg: 100,
      reps: 8,
      durationSeconds: null,
      completedAt: NOW(),
    });
  });

  it('saves nothing while a value is missing or not a value', () => {
    expect(setSaveFor(open('s1'), { weight: '100', reps: '' }, 'weight_reps', 'kg')).toBeNull();
    expect(setSaveFor(open('s1'), { weight: '100.1', reps: '8' }, 'weight_reps', 'kg')).toBeNull();
  });

  it('saves a change to a done set, keeping when it was done -- and nothing when unchanged', () => {
    const done = { ...open('s1'), weightKg: 100, reps: 8, completedAt: '2026-11-13T17:00:00.000Z' };
    expect(setSaveFor(done, { weight: '100', reps: '8' }, 'weight_reps', 'kg')).toBeNull();
    expect(setSaveFor(done, { weight: '100', reps: '9' }, 'weight_reps', 'kg')).toMatchObject({
      reps: 9,
      completedAt: '2026-11-13T17:00:00.000Z',
    });
  });

  it('reopens a done set that is emptied', () => {
    const done = { ...open('s1'), weightKg: 100, reps: 8, completedAt: '2026-11-13T17:00:00.000Z' };
    expect(setSaveFor(done, { weight: '100', reps: '' }, 'weight_reps', 'kg')).toEqual({
      completedAt: null,
    });
  });

  it('saves a bodyweight set on reps, and a timed one on its time', () => {
    expect(
      setSaveFor(open('s1'), { weight: '', reps: '20' }, 'bodyweight', 'kg', NOW),
    ).toMatchObject({ weightKg: null, reps: 20 });
    expect(
      setSaveFor(open('s1'), { weight: '', reps: '', duration: '1:30' }, 'timed', 'kg', NOW),
    ).toMatchObject({ durationSeconds: 90 });
  });
});

describe('sets left empty at Finish', () => {
  const sets: LiveSet[] = [
    { set: open('a1'), type: 'weight_reps', exerciseId: 'we-a', unilateral: false },
    { set: open('b-left', 1, 'left'), type: 'weight_reps', exerciseId: 'we-b', unilateral: true },
    { set: open('b-right', 1, 'right'), type: 'weight_reps', exerciseId: 'we-b', unilateral: true },
  ];

  it('are the ones with a field still empty', () => {
    const empty = unfilledSets(sets, {
      a1: { weight: '50', reps: '10' },
      'b-left': { weight: '20', reps: '10' },
      'b-right': { weight: '', reps: '10' },
    });
    expect(empty.map(({ set }) => set.id)).toEqual(['b-right']);
  });

  it('go with their other side when done one side at a time', () => {
    expect(setIdsToRemove(sets, [sets[2]]).sort()).toEqual(['b-left', 'b-right']);
    expect(setIdsToRemove(sets, [sets[0]])).toEqual(['a1']);
  });

  it('are asked about: fill them in, or remove them and finish', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Remove Them and Finish')?.onPress?.();
    });
    await expect(askAboutEmptySets(2)).resolves.toBe('remove');
    expect(alert.mock.calls[0][0]).toBe('Some sets are missing values');
    alert.mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Fill In')?.onPress?.();
    });
    await expect(askAboutEmptySets(1)).resolves.toBe('fill');
    alert.mockRestore();
  });
});
