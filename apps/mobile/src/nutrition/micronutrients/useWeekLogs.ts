import { useEffect, useState } from 'react';
import { dayFromKey } from '../../lib/dayKey';
import { fetchFoodLogsForRange, type FoodLogRow } from '../foodLogQueries';
import { logsByDay, weekDayKeys } from './weekDays';

/**
 * The week of `day`'s logs, for its averages -- read when it's asked for (null `day` reads
 * nothing) and again each time the page comes back into view, since a food logged or changed
 * one hop away is in it.
 */
export function useWeekLogs(
  userId: string | undefined,
  day: string | null,
  navigation: { addListener: (event: 'focus', callback: () => void) => () => void },
): { days: string[]; logs: FoodLogRow[][] | null; error: string | null } {
  const [state, setState] = useState<{
    for: string | null;
    logs: FoodLogRow[][] | null;
    error: string | null;
  }>({ for: null, logs: null, error: null });
  const [focus, setFocus] = useState(0);
  useEffect(() => navigation.addListener('focus', () => setFocus((n) => n + 1)), [navigation]);

  const days = day ? weekDayKeys(day) : [];
  const first = days[0];
  const last = days[days.length - 1];
  useEffect(() => {
    if (!userId || !day || !first || !last) return;
    let cancelled = false;
    const keys = weekDayKeys(day);
    const end = dayFromKey(last);
    end.setDate(end.getDate() + 1);
    fetchFoodLogsForRange(userId, dayFromKey(first), end)
      .then((logs) => {
        if (!cancelled) setState({ for: day, logs: logsByDay(logs, keys), error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            for: day,
            logs: null,
            error: err instanceof Error ? err.message : 'Couldn’t read the week',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, day, first, last, focus]);

  // Only the week asked for: never one week's logs under another's dates.
  return {
    days,
    logs: state.for === day ? state.logs : null,
    error: state.for === day ? state.error : null,
  };
}
