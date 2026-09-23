import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { deleteFoodLog, fetchTodaysFoodLogs, logFood, updateFoodLogQuantity } from './foodLogQueries';
import { FoodLogProvider, useFoodLog } from './FoodLogProvider';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('./foodLogQueries', () => ({
  fetchTodaysFoodLogs: jest.fn(),
  logFood: jest.fn(),
  updateFoodLogQuantity: jest.fn(),
  deleteFoodLog: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchTodaysFoodLogs = fetchTodaysFoodLogs as jest.Mock;
const mockLogFood = logFood as jest.Mock;
const mockUpdateFoodLogQuantity = updateFoodLogQuantity as jest.Mock;
const mockDeleteFoodLog = deleteFoodLog as jest.Mock;

const sampleLog = {
  id: 'log-1',
  foodId: 'food-1',
  foodNameSnapshot: 'Chicken Breast',
  servingSize: 100,
  servingUnit: 'g',
  quantity: 2,
  calories: 330,
  proteinG: 62,
  carbsG: 0,
  fatG: 7.2,
  mealType: 'lunch' as const,
  loggedAt: '2026-01-01T12:00:00Z',
};

const sampleFood = {
  id: 'food-2',
  name: 'Rice',
  servingSize: 100,
  servingUnit: 'g',
  calories: 130,
  proteinG: 2.7,
  carbsG: 28,
  fatG: 0.3,
  imageUrl: 'https://images.example/rice.jpg',
};

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchTodaysFoodLogs.mockReset().mockResolvedValue([sampleLog]);
  mockLogFood.mockReset();
  mockUpdateFoodLogQuantity.mockReset();
  mockDeleteFoodLog.mockReset();
});

describe('FoodLogProvider', () => {
  it('fetches today\'s logs once and exposes them', async () => {
    const { result } = renderHook(() => useFoodLog(), { wrapper: FoodLogProvider });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.logs).toEqual([sampleLog]);
    expect(mockFetchTodaysFoodLogs).toHaveBeenCalledWith('user-1');
  });

  // The entire point of this provider: previously, NutritionTodayScreen and
  // ProfileScreen each fetched their own copy of today's logs on every
  // focus -- two consumers reading the same context must only cost one fetch.
  it('fetches only once, even with multiple consumers reading the same context', async () => {
    function ConsumerA() {
      useFoodLog();
      return null;
    }
    function ConsumerB() {
      useFoodLog();
      return null;
    }

    render(
      <FoodLogProvider>
        <ConsumerA />
        <ConsumerB />
      </FoodLogProvider>,
    );

    await waitFor(() => expect(mockFetchTodaysFoodLogs).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(mockFetchTodaysFoodLogs).toHaveBeenCalledTimes(1);
  });

  it('does not fetch while signed out, and leaves logs empty', async () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useFoodLog(), { wrapper: FoodLogProvider });

    expect(result.current.logs).toEqual([]);
    expect(mockFetchTodaysFoodLogs).not.toHaveBeenCalled();
  });

  it('sets error, without throwing, when the fetch fails', async () => {
    mockFetchTodaysFoodLogs.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useFoodLog(), { wrapper: FoodLogProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
    expect(result.current.logs).toEqual([]);
  });

  it('logFoodEntry saves via logFood, appends to the cache with the food\'s photo carried over, and never re-fetches', async () => {
    mockLogFood.mockResolvedValue({
      id: 'log-2',
      foodId: 'food-2',
      foodNameSnapshot: 'Rice',
      servingSize: 100,
      servingUnit: 'g',
      quantity: 1,
      calories: 130,
      proteinG: 2.7,
      carbsG: 28,
      fatG: 0.3,
      mealType: 'lunch',
      loggedAt: '2026-01-01T13:00:00Z',
    });

    const { result } = renderHook(() => useFoodLog(), { wrapper: FoodLogProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockFetchTodaysFoodLogs.mockClear();

    await act(async () => {
      await result.current.logFoodEntry(sampleFood, 1, 'lunch');
    });

    expect(mockLogFood).toHaveBeenCalledWith('user-1', sampleFood, 1, 'lunch');
    expect(result.current.logs).toHaveLength(2);
    expect(result.current.logs[1].imageUrl).toBe('https://images.example/rice.jpg');
    expect(mockFetchTodaysFoodLogs).not.toHaveBeenCalled();
  });

  it('updateQuantity saves via updateFoodLogQuantity, keeps the existing photo, and never re-fetches', async () => {
    mockUpdateFoodLogQuantity.mockResolvedValue({ ...sampleLog, quantity: 3, calories: 495 });

    const { result } = renderHook(() => useFoodLog(), { wrapper: FoodLogProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockFetchTodaysFoodLogs.mockClear();

    await act(async () => {
      await result.current.updateQuantity({ ...sampleLog, imageUrl: 'https://images.example/a.jpg' }, 3);
    });

    expect(mockUpdateFoodLogQuantity).toHaveBeenCalledWith(
      { ...sampleLog, imageUrl: 'https://images.example/a.jpg' },
      3,
    );
    expect(result.current.logs[0].calories).toBe(495);
    expect(result.current.logs[0].imageUrl).toBe('https://images.example/a.jpg');
    expect(mockFetchTodaysFoodLogs).not.toHaveBeenCalled();
  });

  it('removeLog deletes via deleteFoodLog and removes it from the cache', async () => {
    mockDeleteFoodLog.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFoodLog(), { wrapper: FoodLogProvider });
    await waitFor(() => expect(result.current.logs).toHaveLength(1));

    await act(async () => {
      await result.current.removeLog('log-1');
    });

    expect(mockDeleteFoodLog).toHaveBeenCalledWith('log-1');
    expect(result.current.logs).toHaveLength(0);
  });

  it('refetch re-fetches from the server', async () => {
    const { result } = renderHook(() => useFoodLog(), { wrapper: FoodLogProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFetchTodaysFoodLogs.mockResolvedValue([sampleLog, { ...sampleLog, id: 'log-3' }]);
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.logs).toHaveLength(2);
  });

  it('throws a clear error when used outside a FoodLogProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useFoodLog())).toThrow(
      'useFoodLog must be used within a FoodLogProvider',
    );
    consoleError.mockRestore();
  });
});
