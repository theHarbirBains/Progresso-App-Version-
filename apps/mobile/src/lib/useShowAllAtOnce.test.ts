import { act, renderHook } from '@testing-library/react-native';
import { SHOW_ALL_WITHIN_MS, useShowAllAtOnce } from './useShowAllAtOnce';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useShowAllAtOnce', () => {
  it('shows once every part is in, and stays shown when a part refreshes', () => {
    const { result, rerender } = renderHook(
      ({ ready }: { ready: boolean }) => useShowAllAtOnce(ready),
      {
        initialProps: { ready: false },
      },
    );
    expect(result.current).toBe(false);

    rerender({ ready: true });
    expect(result.current).toBe(true);

    // A part reading again later never brings the placeholders back.
    rerender({ ready: false });
    expect(result.current).toBe(true);
  });

  it('shows what there is after a few seconds when a part is slow', () => {
    const { result } = renderHook(() => useShowAllAtOnce(false));

    act(() => {
      jest.advanceTimersByTime(SHOW_ALL_WITHIN_MS - 1);
    });
    expect(result.current).toBe(false);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('shows at once when everything is already in', () => {
    const { result } = renderHook(() => useShowAllAtOnce(true));
    expect(result.current).toBe(true);
  });
});
