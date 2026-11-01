import { act, renderHook } from '@testing-library/react-native';
import { SEARCH_DEBOUNCE_MS, useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('settles on the value once it stops changing, not on each change', () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebouncedValue(value),
      {
        initialProps: { value: '' },
      },
    );

    rerender({ value: 'ben' });
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    rerender({ value: 'bench' });
    act(() => jest.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(result.current).toBe('');

    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe('bench');
  });
});
