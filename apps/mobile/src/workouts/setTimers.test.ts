import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import {
  clearSetTimers,
  discardSetTimer,
  openSetTimers,
  pauseSetTimer,
  startSetTimer,
  stopSetTimer,
  timerSeconds,
  useSetTimer,
} from './setTimers';

const KEY = '@progresso/setTimers/w1';

beforeEach(async () => {
  await clearSetTimers('w1');
  await clearSetTimers('w2');
  await AsyncStorage.clear();
  await openSetTimers('w1');
});

describe('set timers', () => {
  it('runs from when it starts, by the clock -- however long the app was away', () => {
    startSetTimer('s1', 1_000);

    // A screen lock or the background stops nothing: the time is the clock's.
    expect(pauseSetTimer('s1', 1_000 + 95_400)).toBe(95);
  });

  it('pauses and resumes, adding the runs together', () => {
    startSetTimer('s1', 0);
    expect(pauseSetTimer('s1', 30_000)).toBe(30);
    // Paused: time stands still.
    expect(pauseSetTimer('s1', 90_000)).toBe(30);

    startSetTimer('s1', 100_000);
    expect(stopSetTimer('s1', 115_500)).toBe(45);
  });

  it('starting a running timer again changes nothing', () => {
    startSetTimer('s1', 0);
    startSetTimer('s1', 20_000);

    expect(stopSetTimer('s1', 30_000)).toBe(30);
  });

  it('ends a timer once it stops, and drops one that is discarded', () => {
    startSetTimer('s1', 0);
    stopSetTimer('s1', 5_000);
    expect(stopSetTimer('s1', 9_000)).toBeNull();

    startSetTimer('s2', 0);
    discardSetTimer('s2');
    expect(pauseSetTimer('s2', 9_000)).toBeNull();
  });

  it('counts whole seconds', () => {
    expect(timerSeconds({ startedAt: null, elapsedMs: 59_999 })).toBe(59);
    expect(timerSeconds({ startedAt: 1_000, elapsedMs: 0 }, 2_500)).toBe(1);
    // A clock set back never runs a timer backwards.
    expect(timerSeconds({ startedAt: 10_000, elapsedMs: 4_000 }, 5_000)).toBe(4);
  });

  it('keeps going after the app closes: read back from the device for the same workout', async () => {
    startSetTimer('s1', 1_000);
    await act(async () => {});
    expect(JSON.parse((await AsyncStorage.getItem(KEY))!)).toEqual({
      s1: { startedAt: 1_000, elapsedMs: 0 },
    });

    // As a fresh start of the app: another workout, then back to this one.
    await openSetTimers('w2');
    expect(pauseSetTimer('s1', 2_000)).toBeNull();
    await openSetTimers('w1');

    expect(pauseSetTimer('s1', 61_000)).toBe(60);
  });

  it('ignores anything on the device that is not a timer', async () => {
    await clearSetTimers('w1');
    await AsyncStorage.setItem(
      KEY,
      JSON.stringify({ good: { startedAt: null, elapsedMs: 5_000 }, bad: { elapsedMs: 'x' } }),
    );

    await openSetTimers('w1');

    expect(pauseSetTimer('good', 0)).toBe(5);
    expect(pauseSetTimer('bad', 0)).toBeNull();
  });

  it("forgets a workout's timers once it's finished or cancelled", async () => {
    startSetTimer('s1', 0);

    await clearSetTimers('w1');
    await openSetTimers('w1');

    expect(pauseSetTimer('s1', 10_000)).toBeNull();
    expect(await AsyncStorage.getItem(KEY)).toBeNull();
  });

  it('tells a row when its timer starts, pauses and ends', () => {
    const { result } = renderHook(() => useSetTimer('s1'));
    expect(result.current).toBeUndefined();

    act(() => startSetTimer('s1', 0));
    expect(result.current).toEqual({ startedAt: 0, elapsedMs: 0 });

    act(() => {
      pauseSetTimer('s1', 4_000);
    });
    expect(result.current).toEqual({ startedAt: null, elapsedMs: 4_000 });

    act(() => {
      stopSetTimer('s1', 4_000);
    });
    expect(result.current).toBeUndefined();
  });
});
