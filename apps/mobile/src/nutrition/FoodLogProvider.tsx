import { createContext, useContext, useEffect, useMemo, useRef, type PropsWithChildren } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useSignedInResource } from '../lib/useSignedInResource';
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
  refetch: () => Promise<boolean>;
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
  const { data: logs, loading, error, refetch, setData: setLogs } = useSignedInResource(
    userId,
    fetchTodaysFoodLogs,
    [] as FoodLogRow[],
    'Failed to load nutrition',
  );

  // "Today" is a moving target this cache doesn't otherwise notice --
  // unlike profile/nutrition goals, fetched-once-and-cached is wrong once
  // local midnight passes while the app stays open (backgrounded or not).
  // Tracks the local calendar day this cache actually reflects, so a
  // day-rollover can be detected without polling. Stamped reactively off
  // useSignedInResource's own loading/error transitions -- not by calling
  // refetch() here -- since the hook already fetches once on sign-in by
  // itself; calling refetch() again on that same transition would fetch
  // twice.
  const cachedDayRef = useRef<string | null>(null);
  useEffect(() => {
    if (!userId) {
      cachedDayRef.current = null;
      return;
    }
    if (!loading && !error) {
      cachedDayRef.current = new Date().toDateString();
    }
  }, [userId, loading, error]);

  // The app is far more likely to be backgrounded overnight than to sit
  // foregrounded and idle across midnight, so refetching on return-to-
  // foreground (rather than a timer) is what actually catches the reported
  // case -- log food at 11:50pm, background the app, reopen after
  // midnight -- without polling while the app is in active use.
  useEffect(() => {
    function handleAppStateChange(nextState: AppStateStatus) {
      if (nextState !== 'active') return;
      if (cachedDayRef.current !== null && cachedDayRef.current !== new Date().toDateString()) {
        void refetch().then((succeeded) => {
          if (succeeded) cachedDayRef.current = new Date().toDateString();
        });
      }
    }
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refetch]);

  const value = useMemo<FoodLogContextValue>(
    () => ({
      logs,
      loading,
      error,
      refetch,
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
    [logs, loading, error, refetch, setLogs, userId],
  );

  return <FoodLogContext.Provider value={value}>{children}</FoodLogContext.Provider>;
}

export function useFoodLog(): FoodLogContextValue {
  const ctx = useContext(FoodLogContext);
  if (!ctx) throw new Error('useFoodLog must be used within a FoodLogProvider');
  return ctx;
}
