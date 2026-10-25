import { useCallback, useEffect, useRef, useState } from 'react';
import { dayFromKey } from '../lib/dayKey';
import {
  deleteFoodLog,
  fetchFoodLogsForDay,
  updateFoodLogQuantity,
  type EnteredAmount,
  type FoodLogRow,
} from './foodLogQueries';

export interface DayLogs {
  /** The day these are for -- the Nutrition screen shows them only when it matches its own. */
  day: string | null;
  logs: FoodLogRow[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateQuantity: (
    log: FoodLogRow,
    newQuantity: number,
    entered?: EnteredAmount | null,
  ) => Promise<FoodLogRow>;
  removeLog: (logId: string) => Promise<void>;
}

/**
 * A past day's food logs, for the Nutrition screen (today's are the shared FoodLogProvider's).
 * Read when the day is chosen and each time the screen is shown again -- a food logged to that day
 * from the logging screens lands there -- with no staleness gate, like a section page opened
 * fresh. Only the latest read is kept, so swiping quickly through days never shows one day's
 * foods under another's date. Null `day` reads nothing.
 */
export function useDayLogs(
  userId: string | undefined,
  day: string | null,
  navigation: { addListener: (event: 'focus', callback: () => void) => () => void },
): DayLogs {
  const [state, setState] = useState<{
    day: string | null;
    logs: FoodLogRow[];
    loading: boolean;
    error: string | null;
  }>({ day: null, logs: [], loading: false, error: null });
  const latest = useRef(0);

  const refetch = useCallback(async () => {
    if (!userId || !day) return;
    const request = ++latest.current;
    // A new day starts blank and loading; the same day keeps what it shows while it's read again.
    setState((prev) =>
      prev.day === day ? { ...prev, error: null } : { day, logs: [], loading: true, error: null },
    );
    try {
      const rows = await fetchFoodLogsForDay(userId, dayFromKey(day));
      if (request === latest.current) setState({ day, logs: rows, loading: false, error: null });
    } catch (err) {
      if (request !== latest.current) return;
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load that day',
      }));
    }
  }, [userId, day]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;
  useEffect(() => navigation.addListener('focus', () => void refetchRef.current()), [navigation]);

  const updateQuantity = useCallback(
    async (log: FoodLogRow, newQuantity: number, entered?: EnteredAmount | null) => {
      const updated = await updateFoodLogQuantity(log, newQuantity, entered);
      const withImage: FoodLogRow = { ...updated, imageUrl: log.imageUrl };
      setState((prev) => ({
        ...prev,
        logs: prev.logs.map((l) => (l.id === log.id ? withImage : l)),
      }));
      return withImage;
    },
    [],
  );

  const removeLog = useCallback(async (logId: string) => {
    await deleteFoodLog(logId);
    setState((prev) => ({ ...prev, logs: prev.logs.filter((l) => l.id !== logId) }));
  }, []);

  return { ...state, refetch, updateQuantity, removeLog };
}
