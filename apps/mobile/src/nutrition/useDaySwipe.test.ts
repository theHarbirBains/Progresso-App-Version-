import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { dayKey } from '../lib/dayKey';
import { fakeTouch } from '../testUtils/fakeTouch';
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

  it('turns from today to tomorrow', () => {
    const { result, onDay } = renderTurn(today, true);

    act(() => result.current.turnTo('next'));

    expect(onDay).toHaveBeenCalledWith(shiftDay(today, 1));
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

  it("deals the new day's widgets in one after another, from the side the day comes in", async () => {
    const { result, onDay, rerender } = renderTurn(yesterday, false);
    const value = (node: unknown) => (node as { __getValue(): number }).__getValue();
    const top = result.current.widgetStyle(0);
    const bottom = result.current.widgetStyle(4);
    expect(value(bottom.opacity)).toBe(1);

    act(() => result.current.turnTo('next'));
    await waitFor(() => expect(onDay).toHaveBeenCalledWith(today));
    rerender({ shown: today });

    // Just after it hands over: the bottom widget is further out and fainter than the top one,
    // on the right -- a day after comes in from the right.
    const offset = (style: typeof top) =>
      value((style.transform[0] as { translateX: unknown }).translateX);
    expect(offset(bottom)).toBeGreaterThan(offset(top));
    expect(offset(bottom)).toBeGreaterThan(0);
    expect(value(bottom.opacity)).toBeLessThanOrEqual(value(top.opacity));
    // (It plays out natively from here, which Jest's stand-in for the native animator doesn't run.)
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

  describe('the gesture, inside a scrolling page', () => {
    it('claims a sideways drag on the way down, before the page scroll can', () => {
      const { result } = renderTurn(yesterday, true);
      const capture = result.current.panHandlers.onMoveShouldSetResponderCapture!;

      expect(capture(fakeTouch(8, 1, 16))).toBe(true);
    });

    it('leaves an up-and-down drag to the page', () => {
      const { result } = renderTurn(yesterday, true);
      const capture = result.current.panHandlers.onMoveShouldSetResponderCapture!;

      expect(capture(fakeTouch(2, 30, 16))).toBe(false);
    });

    it("never gives the swipe up to the page's scroll once it has it", () => {
      const { result } = renderTurn(yesterday, true);

      expect(result.current.panHandlers.onResponderTerminationRequest!(fakeTouch(0, 0, 1))).toBe(
        false,
      );
    });

    it('says a swipe is under way from the moment it is claimed until it ends', () => {
      const { result } = renderTurn(yesterday, true);
      expect(result.current.swiping).toBe(false);

      act(() => {
        result.current.panHandlers.onResponderGrant!(fakeTouch(8, 0, 16));
      });
      expect(result.current.swiping).toBe(true);

      act(() => {
        result.current.panHandlers.onResponderRelease!(fakeTouch(8, 0, 32));
      });
      expect(result.current.swiping).toBe(false);
    });

    it('turns to the day before on a swipe from left to right', () => {
      const { result, onDay } = renderTurn(yesterday, true);
      const handlers = result.current.panHandlers;

      act(() => {
        handlers.onResponderGrant!(fakeTouch(0, 0, 1));
        handlers.onResponderMove!(fakeTouch(120, 4, 120, { x: 0, y: 0, time: 1 }));
        handlers.onResponderRelease!(fakeTouch(120, 4, 130, { x: 120, y: 4, time: 120 }));
      });

      expect(onDay).toHaveBeenCalledWith(shiftDay(yesterday, -1));
    });

    it('turns to the day after on a swipe from right to left', () => {
      const { result, onDay } = renderTurn(yesterday, true);
      const handlers = result.current.panHandlers;

      act(() => {
        handlers.onResponderGrant!(fakeTouch(0, 0, 1));
        handlers.onResponderMove!(fakeTouch(-120, 4, 120, { x: 0, y: 0, time: 1 }));
        handlers.onResponderRelease!(fakeTouch(-120, 4, 130, { x: -120, y: 4, time: 120 }));
      });

      expect(onDay).toHaveBeenCalledWith(today);
    });

    it('turns from today to tomorrow on a swipe from right to left', () => {
      const { result, onDay } = renderTurn(today, true);
      const handlers = result.current.panHandlers;

      act(() => {
        handlers.onResponderGrant!(fakeTouch(0, 0, 1));
        handlers.onResponderMove!(fakeTouch(-160, 4, 120, { x: 0, y: 0, time: 1 }));
        handlers.onResponderRelease!(fakeTouch(-160, 4, 130, { x: -160, y: 4, time: 120 }));
      });

      expect(onDay).toHaveBeenCalledWith(shiftDay(today, 1));
    });
  });
});
