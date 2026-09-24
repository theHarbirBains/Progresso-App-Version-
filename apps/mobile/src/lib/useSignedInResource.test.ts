import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useSignedInResource } from './useSignedInResource';

describe('useSignedInResource', () => {
  it('fetches once and exposes the result', async () => {
    const fetcher = jest.fn().mockResolvedValue('the-data');

    const { result } = renderHook(() =>
      useSignedInResource('key-1', fetcher, null, 'Failed to load'),
    );

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBe('the-data');
    expect(result.current.error).toBeNull();
    expect(fetcher).toHaveBeenCalledWith('key-1');
  });

  it('does not fetch while the key is undefined, and leaves data at emptyValue', () => {
    const fetcher = jest.fn();

    const { result } = renderHook(() =>
      useSignedInResource(undefined, fetcher, 'empty', 'Failed to load'),
    );

    expect(result.current.data).toBe('empty');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('resets to emptyValue and loading=true when the key becomes undefined (sign-out)', async () => {
    const fetcher = jest.fn().mockResolvedValue('the-data');

    const { result, rerender } = renderHook(
      ({ key }: { key: string | undefined }) =>
        useSignedInResource(key, fetcher, 'empty', 'Failed to load'),
      { initialProps: { key: 'key-1' } },
    );
    await waitFor(() => expect(result.current.data).toBe('the-data'));

    rerender({ key: undefined });

    expect(result.current.data).toBe('empty');
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('sets error, without throwing, when the fetch fails', async () => {
    const fetcher = jest.fn().mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() =>
      useSignedInResource('key-1', fetcher, null, 'Failed to load'),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
    expect(result.current.data).toBeNull();
  });

  it('falls back to the given message for a non-Error rejection', async () => {
    const fetcher = jest.fn().mockRejectedValue('boom');

    const { result } = renderHook(() =>
      useSignedInResource('key-1', fetcher, null, 'Failed to load'),
    );

    await waitFor(() => expect(result.current.error).toBe('Failed to load'));
  });

  it('setData updates the cache directly, with no fetch of its own', async () => {
    const fetcher = jest.fn<Promise<string | null>, [string]>().mockResolvedValue('the-data');

    const { result } = renderHook(() =>
      useSignedInResource('key-1', fetcher, null, 'Failed to load'),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    fetcher.mockClear();

    act(() => {
      result.current.setData('written-directly');
    });

    expect(result.current.data).toBe('written-directly');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('refetch re-fetches from the server', async () => {
    const fetcher = jest.fn().mockResolvedValue('first');

    const { result } = renderHook(() =>
      useSignedInResource('key-1', fetcher, null, 'Failed to load'),
    );
    await waitFor(() => expect(result.current.data).toBe('first'));

    fetcher.mockResolvedValue('second');
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.data).toBe('second');
  });

  // FoodLogProvider's own day-rollover tracking needs to know whether a
  // refetch actually succeeded, without a state-closure staleness trap --
  // this is the mechanism that makes that possible.
  it('refetch resolves true on success and false on failure', async () => {
    const fetcher = jest.fn().mockResolvedValue('first');

    const { result } = renderHook(() =>
      useSignedInResource('key-1', fetcher, null, 'Failed to load'),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    let succeeded: boolean | undefined;
    await act(async () => {
      succeeded = await result.current.refetch();
    });
    expect(succeeded).toBe(true);

    fetcher.mockRejectedValue(new Error('network down'));
    let failed: boolean | undefined;
    await act(async () => {
      failed = await result.current.refetch();
    });
    expect(failed).toBe(false);
  });

  // The entire point of the shared "fetch once per sign-in" providers this
  // hook backs: multiple consumers reading the same context must only cost
  // one fetch, not one each. Covered here at the hook level since every
  // provider's own test file already covers it at the context level too.
  it('a re-render with the same key does not trigger a second fetch', async () => {
    const fetcher = jest.fn().mockResolvedValue('the-data');

    const { result, rerender } = renderHook(() =>
      useSignedInResource('key-1', fetcher, null, 'Failed to load'),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({});
    rerender({});

    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
