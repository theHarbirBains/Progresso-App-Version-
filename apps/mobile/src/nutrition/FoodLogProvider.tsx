import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  deleteFoodLog,
  fetchTodaysFoodLogs,
  logFood,
  updateFoodLogQuantity,
  type FoodLogRow,
} from './foodLogQueries';
import type { MealType } from './mealTypes';
import type { LoggableFood } from './LogFoodStep';

export interface FoodLogContextValue {
  logs: FoodLogRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  logFoodEntry: (food: LoggableFood, quantity: number, mealType: MealType) => Promise<FoodLogRow>;
  updateQuantity: (log: FoodLogRow, newQuantity: number) => Promise<FoodLogRow>;
  removeLog: (logId: string) => Promise<void>;
}

const FoodLogContext = createContext<FoodLogContextValue | undefined>(undefined);

// Today's food logs -- same shape as ProfileProvider, shared by
// NutritionTodayScreen and ProfileScreen (both previously fetched their own
// copy on every focus) -- but unlike profile/nutrition goals there are three
// separate write paths, not one: logging a food (LogFoodStep, reused by
// FoodLibraryScreen/FoodSearchScreen/BarcodeScannerScreen), editing a
// quantity, and deleting an entry. All three flow through this cache instead
// of their own local state, so any of them is reflected everywhere
// immediately with no re-fetch -- including NutritionTodayScreen itself no
// longer needing its old "re-fetch on focus" fallback for a food logged
// elsewhere.
export function FoodLogProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const userId = user?.id;
  const [logs, setLogs] = useState<FoodLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const result = await fetchTodaysFoodLogs(userId);
      setLogs(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load nutrition');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLogs([]);
      setError(null);
      setLoading(true);
      return;
    }
    void load();
  }, [userId, load]);

  const value = useMemo<FoodLogContextValue>(
    () => ({
      logs,
      loading,
      error,
      refetch: load,
      logFoodEntry: async (food, quantity, mealType) => {
        if (!userId) throw new Error('Not signed in');
        const created = await logFood(userId, food, quantity, mealType);
        // logFood's own return never carries a photo (only the dedicated
        // today's-list select embeds one) -- carried over here from the food
        // that was just logged, same as the merge NutritionTodayScreen's own
        // quantity update already did before this provider existed.
        const withImage: FoodLogRow = { ...created, imageUrl: food.imageUrl ?? null };
        setLogs((prev) => [...prev, withImage]);
        return withImage;
      },
      updateQuantity: async (log, newQuantity) => {
        const updated = await updateFoodLogQuantity(log, newQuantity);
        const withImage: FoodLogRow = { ...updated, imageUrl: log.imageUrl };
        setLogs((prev) => prev.map((l) => (l.id === log.id ? withImage : l)));
        return withImage;
      },
      removeLog: async (logId) => {
        await deleteFoodLog(logId);
        setLogs((prev) => prev.filter((l) => l.id !== logId));
      },
    }),
    [logs, loading, error, load, userId],
  );

  return <FoodLogContext.Provider value={value}>{children}</FoodLogContext.Provider>;
}

export function useFoodLog(): FoodLogContextValue {
  const ctx = useContext(FoodLogContext);
  if (!ctx) throw new Error('useFoodLog must be used within a FoodLogProvider');
  return ctx;
}
