import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { recordQuietFailure } from '../lib/sentry';
import { showStepsWidget } from '../widgets/widgetUpdates';
import { askForSteps, stepsAccess, stepsByDay, type DaySteps, type StepsAccess } from './steps';

export interface StepsHistoryRead {
  /** Null until it's known; 'unavailable' off iPhone. */
  access: StepsAccess | null;
  /** Each day's count, oldest first and today last, once asked; else null. */
  days: DaySteps[] | null;
  connecting: boolean;
  /** Why Apple Health couldn't be reached, when it couldn't -- shown, not hidden. */
  failure: string | null;
  /** Asks Apple Health for steps, then reads them. */
  connect: () => Promise<void>;
}

/**
 * The last `count` days' steps for Progress's Health tab, read from Apple Health on the phone when
 * the tab opens and whenever the app comes back to the front -- a local read, so nothing is cached
 * or stored. Today's count is handed to the Steps widget as it's read, as Feed's is.
 */
export function useStepsHistory(
  count: number,
  now: () => Date = () => new Date(),
): StepsHistoryRead {
  const [access, setAccess] = useState<StepsAccess | null>(null);
  const [days, setDays] = useState<DaySteps[] | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const mounted = useRef(true);
  const clock = useRef(now);
  clock.current = now;

  const failed = useCallback((error: unknown) => {
    recordQuietFailure('health.steps', error);
    if (mounted.current && Platform.OS === 'ios') {
      setFailure(error instanceof Error ? error.message || error.name : String(error));
    }
  }, []);

  const read = useCallback(async () => {
    try {
      const nextAccess = await stepsAccess();
      if (!mounted.current) return;
      setAccess(nextAccess);
      setFailure(null);
      if (nextAccess !== 'asked') return;
      const counts = await stepsByDay(count, clock.current());
      if (!mounted.current) return;
      setDays(counts);
      const today = counts[counts.length - 1];
      if (today) void showStepsWidget(today.steps);
    } catch (error) {
      failed(error);
    }
  }, [count, failed]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await askForSteps();
      await read();
    } catch (error) {
      failed(error);
    } finally {
      if (mounted.current) setConnecting(false);
    }
  }, [read, failed]);

  useEffect(() => {
    mounted.current = true;
    void read();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void read();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [read]);

  return { access, days, connecting, failure, connect };
}
