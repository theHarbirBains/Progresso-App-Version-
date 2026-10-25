import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { dayKey } from '../lib/dayKey';
import { shiftDay } from './logDay';
import { useDaySwipe } from './useDaySwipe';

const today = dayKey(new Date());
const yesterday = shiftDay(today, -1);

function renderTurn(day: string, reduceMotion: boolean) {
  const onDay = jest.fn();
  const hook = renderHook(
    ({ shown }: { shown: string }) => useDaySwipe({ day: shown, onDay, width: 390, reduceMotion }),
    { initialProps: { shown: day } },
  );
  return { ...hook, onDay };
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('useDaySwipe', () => {
  it('turns to the day before, and the day after a past day', () => {
    const { result, onDay } = renderTurn(yesterday, true);

    act(() => result.current.turnTo('previous'));
    expect(onDay).toHaveBeenLastCalledWith(shiftDay(yesterday, -1));

    act(() => result.current.turnTo('next'));
    expect(onDay).toHaveBeenLastCalledWith(today);
  });

  it('never turns past today', () => {
    const { result, onDay } = renderTurn(today, true);

    act(() => result.current.turnTo('next'));

    expect(onDay).not.toHaveBeenCalled();
  });

  it('turns straight back to today from any day', () => {
    const { result, onDay } = renderTurn(shiftDay(today, -9), true);

    act(() => result.current.turnTo('next', today));

    expect(onDay).toHaveBeenCalledWith(today);
  });

  it('turns away first, then hands over the day, when motion is on', async () => {
    const { result, onDay, rerender } = renderTurn(yesterday, false);

    act(() => result.current.turnTo('previous'));
    expect(onDay).not.toHaveBeenCalled();

    await waitFor(() => expect(onDay).toHaveBeenCalledWith(shiftDay(yesterday, -1)));
    // The new day swings in once it has rendered, and the next turn can follow.
    rerender({ shown: shiftDay(yesterday, -1) });
    await waitFor(() => {
      act(() => result.current.turnTo('previous'));
      expect(onDay).toHaveBeenCalledWith(shiftDay(yesterday, -2));
    });
  });

  it('nudges once, the first time it is seen on this phone, to show the day turns', async () => {
    renderTurn(today, false);
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('@progresso/nutritionSwipeHint')).toBe('1'),
    );
  });

  it('never nudges under Reduce Motion', async () => {
    renderTurn(today, true);
    await act(async () => {});

    expect(await AsyncStorage.getItem('@progresso/nutritionSwipeHint')).toBeNull();
  });
});
