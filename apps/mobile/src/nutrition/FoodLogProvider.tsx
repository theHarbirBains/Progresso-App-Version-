import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { recordQuietFailure } from '../lib/sentry';
import { useSignedInResource } from '../lib/useSignedInResource';
import {
  deleteFoodLog,
  fetchTodaysFoodLogs,
  copyFoodLogs,
  logFood,
  logQuickEntry,
  updateFoodLogQuantity,
  type EnteredAmount,
  type FoodLogRow,
  type QuickEntry,
} from './foodLogQueries';
import { createFood, keepInLibrary, USER_ENTERED } from './foodQueries';
import { loggedAtFor } from './logDay';
import type { MealType } from './mealTypes';
import type { LoggableFood } from './LogFoodStep';

export interface FoodLogContextValue {
  logs: FoodLogRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<boolean>;
  /**
   * Logs a food, kept in the Food Library first (a food that isn't the person's own is copied
   * there once -- foodQueries.keepInLibrary). `day` ("YYYY-MM-DD") logs it to a past day instead
   * of now; only today's logs are held here, so a past day's log is returned, not added.
   */
  logFoodEntry: (
    food: LoggableFood,
    quantity: number,
    mealType: MealType,
    entered?: EnteredAmount | null,
    day?: string,
  ) => Promise<FoodLogRow>;
  /** Logs several foods, one entry each, in order -- a saved meal -- each kept in the library. */
  logFoodEntries: (
    entries: { food: LoggableFood; quantity: number; entered?: EnteredAmount | null }[],
    mealType: MealType,
    day?: string,
  ) => Promise<FoodLogRow[]>;
  /**
   * Logs figures the person typed, with no food behind them. With `saveToLibrary`, it's also
   * kept as one of their foods, marked as figures they entered, and the log points at it.
   */
  logQuickEntry: (
    entry: QuickEntry,
    mealType: MealType,
    options?: { day?: string; saveToLibrary?: boolean },
  ) => Promise<FoodLogRow>;
  /** Logs past logs again, now, exactly as they were logged -- Copy Yesterday. */
  copyLogs: (logIds: string[]) => Promise<FoodLogRow[]>;
  updateQuantity: (
    log: FoodLogRow,
    newQuantity: number,
    entered?: EnteredAmount | null,
  ) => Promise<FoodLogRow>;
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
  const {
    data: logs,
    loading,
    error,
    refetch,
    setData: setLogs,
  } = useSignedInResource(
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

  const value = useMemo<FoodLogContextValue>(() => {
    // The food a log points at, kept in the library. Keeping it is never a reason not to log:
    // if the copy can't be made, the food is logged as it was, and the failure recorded.
    async function kept(food: LoggableFood): Promise<LoggableFood> {
      if (!userId || !food.id) return food;
      try {
        const own = await keepInLibrary(userId, food.id);
        return own ? { ...own, imageUrl: own.imageUrl ?? food.imageUrl ?? null } : food;
      } catch (err) {
        recordQuietFailure('nutrition.keepInLibrary', err);
        return food;
      }
    }

    return {
      logs,
      loading,
      error,
      refetch,
      logFoodEntry: async (food, quantity, mealType, entered, day) => {
        if (!userId) throw new Error('Not signed in');
        const loggedAt = loggedAtFor(day);
        const target = await kept(food);
        const created = await logFood(userId, target, quantity, mealType, entered, loggedAt);
        // logFood's own return never carries a photo (only the dedicated
        // today's-list select embeds one) -- carried over here from the food
        // that was just logged, same as the merge NutritionTodayScreen's own
        // quantity update already did before this provider existed.
        const withImage: FoodLogRow = { ...created, imageUrl: target.imageUrl ?? null };
        if (!loggedAt) setLogs((prev) => [...prev, withImage]);
        return withImage;
      },
      logFoodEntries: async (entries, mealType, day) => {
        if (!userId) throw new Error('Not signed in');
        const loggedAt = loggedAtFor(day);
        const created: FoodLogRow[] = [];
        // One at a time, so a failure part way leaves the ones logged so far in Today.
        try {
          for (const entry of entries) {
            const target = await kept(entry.food);
            const row = await logFood(
              userId,
              target,
              entry.quantity,
              mealType,
              entry.entered,
              loggedAt,
            );
            created.push({ ...row, imageUrl: target.imageUrl ?? null });
          }
        } finally {
          if (!loggedAt && created.length > 0) setLogs((prev) => [...prev, ...created]);
        }
        return created;
      },
      logQuickEntry: async (entry, mealType, options = {}) => {
        if (!userId) throw new Error('Not signed in');
        const loggedAt = loggedAtFor(options.day);
        let created: FoodLogRow;
        if (options.saveToLibrary) {
          const food = await createFood(userId, {
            name: entry.name,
            servingSize: 1,
            servingUnit: 'serving',
            calories: entry.calories,
            proteinG: entry.proteinG,
            carbsG: entry.carbsG,
            fatG: entry.fatG,
            provenance: USER_ENTERED,
          });
          created = await logFood(userId, food, 1, mealType, null, loggedAt);
        } else {
          created = await logQuickEntry(userId, entry, mealType, loggedAt);
        }
        if (!loggedAt) setLogs((prev) => [...prev, created]);
        return created;
      },
      copyLogs: async (logIds) => {
        if (!userId) throw new Error('Not signed in');
        const copies = await copyFoodLogs(userId, logIds);
        setLogs((prev) => [...prev, ...copies]);
        return copies;
      },
      updateQuantity: async (log, newQuantity, entered) => {
        const updated = await updateFoodLogQuantity(log, newQuantity, entered);
        const withImage: FoodLogRow = { ...updated, imageUrl: log.imageUrl };
        setLogs((prev) => prev.map((l) => (l.id === log.id ? withImage : l)));
        return withImage;
      },
      removeLog: async (logId) => {
        await deleteFoodLog(logId);
        setLogs((prev) => prev.filter((l) => l.id !== logId));
      },
    };
  }, [logs, loading, error, refetch, setLogs, userId]);

  return <FoodLogContext.Provider value={value}>{children}</FoodLogContext.Provider>;
}

export function useFoodLog(): FoodLogContextValue {
  const ctx = useContext(FoodLogContext);
  if (!ctx) throw new Error('useFoodLog must be used within a FoodLogProvider');
  return ctx;
}
