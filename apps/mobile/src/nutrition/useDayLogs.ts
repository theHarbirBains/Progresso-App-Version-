import { useCallback, useEffect, useRef, useState } from 'react';
import { dayFromKey } from '../lib/dayKey';
import { recallShown, rememberShown } from '../lib/lastShown';
import {
  deleteFoodLog,
  fetchFoodLogsForDay,
  updateFoodLogQuantity,
  type EnteredAmount,
  type FoodLogRow,
} from './foodLogQueries';

const shownKey = (day: string) => `nutrition.day.${day}`;

/**
 * Reads a day's logs and remembers them for the session (lib/lastShown.ts), so the Nutrition
 * screen can show that day at once when it's turned to.
 */
export async function readDayLogs(userId: string, day: string): Promise<FoodLogRow[]> {
  const rows = await fetchFoodLogsForDay(userId, dayFromKey(day));
  rememberShown(userId, shownKey(day), rows);
  return rows;
}

/**
 * Reads a day ahead of being turned to -- the day before the one shown, the next swipe's -- so the
 * swipe lands on its foods rather than a placeholder. Only a day not read yet this session; a
 * failure just means that day loads as usual when it's reached.
 */
const readingAhead = new Set<string>();

export function readAheadDayLogs(userId: string, day: string): void {
  const reading = `${userId}:${day}`;
  if (readingAhead.has(reading) || recallShown(userId, shownKey(day)) !== undefined) return;
  readingAhead.add(reading);
  readDayLogs(userId, day)
    .catch(() => undefined)
    .finally(() => readingAhead.delete(reading));
}

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
 * Another day's food logs -- before today or ahead of it -- for the Nutrition screen (today's are
 * the shared FoodLogProvider's).
 * Read when the day is chosen and each time the screen is shown again -- a food logged to that day
 * from the logging screens lands there -- with no staleness gate, like a section page opened
 * fresh. A day already seen (or read ahead) this session shows at once while it's read again.
 * Only the latest read is kept, so swiping quickly through days never shows one day's foods under
 * another's date. Null `day` reads nothing.
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
    // A new day starts from what it last showed, else blank and loading; the same day keeps what
    // it shows while it's read again.
    setState((prev) => {
      if (prev.day === day) return { ...prev, error: null };
      const remembered = recallShown<FoodLogRow[]>(userId, shownKey(day));
      return remembered
        ? { day, logs: remembered, loading: false, error: null }
        : { day, logs: [], loading: true, error: null };
    });
    try {
      const rows = await readDayLogs(userId, day);
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

  // An edit or a delete here is what the day shows next time too.
  useEffect(() => {
    if (state.day && !state.loading) rememberShown(userId, shownKey(state.day), state.logs);
  }, [userId, state]);

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

  // A day moved to shows what it last showed from its very first frame -- not a frame of loading
  // before the read below picks it up -- so a swipe lands on the day's foods, never a blank.
  if (userId && day && state.day !== day) {
    const remembered = recallShown<FoodLogRow[]>(userId, shownKey(day));
    if (remembered) {
      return {
        day,
        logs: remembered,
        loading: false,
        error: null,
        refetch,
        updateQuantity,
        removeLog,
      };
    }
  }
  return { ...state, refetch, updateQuantity, removeLog };
}
