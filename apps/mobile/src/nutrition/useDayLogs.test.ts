import { act, renderHook, waitFor } from '@testing-library/react-native';
import { dayKey } from '../lib/dayKey';
import { deleteFoodLog, fetchFoodLogsForDay, updateFoodLogQuantity } from './foodLogQueries';
import { readAheadDayLogs, useDayLogs } from './useDayLogs';

jest.mock('./foodLogQueries', () => ({
  fetchFoodLogsForDay: jest.fn(),
  updateFoodLogQuantity: jest.fn(),
  deleteFoodLog: jest.fn(),
}));

const mockFetch = fetchFoodLogsForDay as jest.Mock;
const mockUpdate = updateFoodLogQuantity as jest.Mock;
const mockDelete = deleteFoodLog as jest.Mock;

function log(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    foodId: 'food-1',
    foodNameSnapshot: 'Rice',
    servingSize: 100,
    servingUnit: 'g',
    quantity: 1,
    calories: 130,
    proteinG: 2.7,
    carbsG: 28,
    fatG: 0.3,
    mealType: 'lunch' as const,
    loggedAt: '2026-10-20T12:00:00Z',
    ...extra,
  };
}

// A navigation stand-in whose focus listeners the test fires itself.
function fakeNavigation() {
  const listeners: (() => void)[] = [];
  return {
    addListener: jest.fn((_event: 'focus', callback: () => void) => {
      listeners.push(callback);
      return () => listeners.splice(listeners.indexOf(callback), 1);
    }),
    focus: () => listeners.forEach((l) => l()),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

beforeEach(() => {
  mockFetch.mockReset().mockResolvedValue([log('log-1')]);
  mockUpdate.mockReset();
  mockDelete.mockReset();
});

describe('useDayLogs', () => {
  it("reads that day's logs", async () => {
    const navigation = fakeNavigation();
    const { result } = renderHook(() => useDayLogs('user-1', '2026-10-20', navigation));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.day).toBe('2026-10-20');
    expect(result.current.logs).toEqual([log('log-1')]);
    const [userId, day] = mockFetch.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(dayKey(day as Date)).toBe('2026-10-20');
  });

  it('reads nothing for no day, or when signed out', async () => {
    const navigation = fakeNavigation();
    renderHook(() => useDayLogs('user-1', null, navigation));
    renderHook(() => useDayLogs(undefined, '2026-10-20', navigation));
    await act(async () => {});

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('reads the day again each time the screen is shown', async () => {
    const navigation = fakeNavigation();
    const { result } = renderHook(() => useDayLogs('user-1', '2026-10-20', navigation));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFetch.mockResolvedValue([log('log-1'), log('log-2')]);
    act(() => navigation.focus());

    await waitFor(() => expect(result.current.logs).toHaveLength(2));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("never shows one day's foods under another's, however the reads finish", async () => {
    const first = deferred<unknown[]>();
    const second = deferred<unknown[]>();
    mockFetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const navigation = fakeNavigation();
    const { result, rerender } = renderHook(
      ({ day }: { day: string }) => useDayLogs('user-1', day, navigation),
      { initialProps: { day: '2026-10-20' } },
    );

    rerender({ day: '2026-10-19' });
    await act(async () => second.resolve([log('log-19')]));
    await act(async () => first.resolve([log('log-20')]));

    expect(result.current.day).toBe('2026-10-19');
    expect(result.current.logs.map((l) => l.id)).toEqual(['log-19']);
  });

  it('starts a new day blank and loading', async () => {
    const navigation = fakeNavigation();
    const { result, rerender } = renderHook(
      ({ day }: { day: string }) => useDayLogs('user-1', day, navigation),
      { initialProps: { day: '2026-10-20' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFetch.mockReturnValue(new Promise(() => {}));
    rerender({ day: '2026-10-19' });

    expect(result.current.loading).toBe(true);
    expect(result.current.logs).toEqual([]);
  });

  it('sets the error when the read fails', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const navigation = fakeNavigation();
    const { result } = renderHook(() => useDayLogs('user-1', '2026-10-20', navigation));

    await waitFor(() => expect(result.current.error).toBe('network down'));
    expect(result.current.loading).toBe(false);
  });

  it("changes and removes the day's logs in place", async () => {
    const navigation = fakeNavigation();
    const { result } = renderHook(() => useDayLogs('user-1', '2026-10-20', navigation));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockUpdate.mockResolvedValue(log('log-1', { quantity: 2, calories: 260 }));
    await act(async () => {
      await result.current.updateQuantity(log('log-1', { imageUrl: 'https://img/rice.jpg' }), 2);
    });
    expect(result.current.logs[0]).toMatchObject({
      calories: 260,
      imageUrl: 'https://img/rice.jpg',
    });

    mockDelete.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.removeLog('log-1');
    });
    expect(mockDelete).toHaveBeenCalledWith('log-1');
    expect(result.current.logs).toEqual([]);
  });

  it('shows a day seen before at once, while it reads it again', async () => {
    const navigation = fakeNavigation();
    const { result, rerender } = renderHook(
      ({ day }: { day: string }) => useDayLogs('user-1', day, navigation),
      { initialProps: { day: '2026-10-20' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ day: '2026-10-19' });
    await waitFor(() => expect(result.current.day).toBe('2026-10-19'));

    mockFetch.mockReturnValue(new Promise(() => {}));
    rerender({ day: '2026-10-20' });

    expect(result.current.loading).toBe(false);
    expect(result.current.logs).toEqual([log('log-1')]);
  });

  it("hands over a remembered day's foods from the very first render of it", async () => {
    const navigation = fakeNavigation();
    const renders: { day: string | null; loading: boolean }[] = [];
    const { result, rerender } = renderHook(
      ({ day }: { day: string }) => {
        const shown = useDayLogs('user-1', day, navigation);
        renders.push({ day: shown.day, loading: shown.loading });
        return shown;
      },
      { initialProps: { day: '2026-10-20' } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    rerender({ day: '2026-10-19' });
    await waitFor(() => expect(result.current.day).toBe('2026-10-19'));

    mockFetch.mockReturnValue(new Promise(() => {}));
    renders.length = 0;
    rerender({ day: '2026-10-20' });

    // Never a frame still on the day before, nor one loading: a swipe lands on the day's foods.
    expect(renders[0]).toEqual({ day: '2026-10-20', loading: false });
  });

  it('reads a day ahead only once, and that read is what the day shows', async () => {
    mockFetch.mockResolvedValue([log('log-ahead')]);
    readAheadDayLogs('user-1', '2026-10-18');
    readAheadDayLogs('user-1', '2026-10-18');
    await act(async () => {});
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDayLogs('user-1', '2026-10-18', fakeNavigation()));

    expect(result.current.loading).toBe(false);
    expect(result.current.logs.map((l) => l.id)).toEqual(['log-ahead']);
  });
});
