import { act, render, renderHook, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { fetchNutritionGoals, saveNutritionGoals } from './nutritionGoalQueries';
import { NutritionGoalsProvider, useNutritionGoals } from './NutritionGoalsProvider';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('./nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn(),
  saveNutritionGoals: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchNutritionGoals = fetchNutritionGoals as jest.Mock;
const mockSaveNutritionGoals = saveNutritionGoals as jest.Mock;

const baseGoals = { calories: 2200, proteinG: 180, carbsG: 220, fatG: 70 };

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: { id: 'user-1' } });
  mockFetchNutritionGoals.mockReset().mockResolvedValue(baseGoals);
  mockSaveNutritionGoals.mockReset();
});

describe('NutritionGoalsProvider', () => {
  it('fetches the goals once and exposes them', async () => {
    const { result } = renderHook(() => useNutritionGoals(), { wrapper: NutritionGoalsProvider });

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.goals).toEqual(baseGoals);
    expect(result.current.error).toBeNull();
    expect(mockFetchNutritionGoals).toHaveBeenCalledWith('user-1');
  });

  // The entire point of this provider: previously, NutritionTodayScreen and
  // ProfileScreen each fetched their own copy of the same goals row on every
  // focus -- two consumers reading the same context must only cost one fetch.
  it('fetches only once, even with multiple consumers reading the same context', async () => {
    function ConsumerA() {
      useNutritionGoals();
      return null;
    }
    function ConsumerB() {
      useNutritionGoals();
      return null;
    }

    render(
      <NutritionGoalsProvider>
        <ConsumerA />
        <ConsumerB />
      </NutritionGoalsProvider>,
    );

    await waitFor(() => expect(mockFetchNutritionGoals).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(mockFetchNutritionGoals).toHaveBeenCalledTimes(1);
  });

  it('does not fetch while signed out, and leaves goals null', async () => {
    mockUseAuth.mockReturnValue({ user: null });

    const { result } = renderHook(() => useNutritionGoals(), { wrapper: NutritionGoalsProvider });

    expect(result.current.goals).toBeNull();
    expect(mockFetchNutritionGoals).not.toHaveBeenCalled();
  });

  it('clears the cached goals on sign-out, so a later sign-in never flashes the previous account', async () => {
    const { result, rerender } = renderHook(() => useNutritionGoals(), {
      wrapper: NutritionGoalsProvider,
    });
    await waitFor(() => expect(result.current.goals).toEqual(baseGoals));

    mockUseAuth.mockReturnValue({ user: null });
    rerender({});

    expect(result.current.goals).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it('sets error, without throwing, when the fetch fails', async () => {
    mockFetchNutritionGoals.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useNutritionGoals(), { wrapper: NutritionGoalsProvider });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('network down');
    expect(result.current.goals).toBeNull();
  });

  it('saveGoals saves via saveNutritionGoals and updates the cache from its response -- no second fetch', async () => {
    mockSaveNutritionGoals.mockResolvedValue({ ...baseGoals, calories: 2400 });

    const { result } = renderHook(() => useNutritionGoals(), { wrapper: NutritionGoalsProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockFetchNutritionGoals.mockClear();

    await act(async () => {
      await result.current.saveGoals({ ...baseGoals, calories: 2400 });
    });

    expect(mockSaveNutritionGoals).toHaveBeenCalledWith('user-1', { ...baseGoals, calories: 2400 });
    expect(result.current.goals?.calories).toBe(2400);
    expect(mockFetchNutritionGoals).not.toHaveBeenCalled();
  });

  it('refetch re-fetches from the server', async () => {
    const { result } = renderHook(() => useNutritionGoals(), { wrapper: NutritionGoalsProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFetchNutritionGoals.mockResolvedValue({ ...baseGoals, calories: 1800 });
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.goals?.calories).toBe(1800);
  });

  it('throws a clear error when used outside a NutritionGoalsProvider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useNutritionGoals())).toThrow(
      'useNutritionGoals must be used within a NutritionGoalsProvider',
    );
    consoleError.mockRestore();
  });
});
