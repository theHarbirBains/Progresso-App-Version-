import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { recallShown, rememberShown } from '../lib/lastShown';
import { recordQuietFailure } from '../lib/sentry';
import { showStepsWidget } from '../widgets/widgetUpdates';
import { askForSteps, stepsAccess, stepsByDay, stepsToday, type StepsAccess } from './steps';

export interface StepsToday {
  /** Null until it's known; 'unavailable' off iPhone. */
  access: StepsAccess | null;
  /** Today's count once asked, else null. */
  steps: number | null;
  /** The average of the 7 days before today, as the Health tab works it out -- what Feed's
   * Daily Steps widget's bar measures today against (there's no step goal). Null until read, or
   * when it couldn't be. */
  average: number | null;
  connecting: boolean;
  /** Why Apple Health couldn't be reached, when it couldn't -- shown on the card, not hidden. */
  failure: string | null;
  /** Reads the count again -- Feed calls it each time it's shown. */
  refresh: () => Promise<void>;
  /** Asks Apple Health for steps, then reads them. */
  connect: () => Promise<void>;
}

/** What Feed last showed of today's steps, for `userId` (lib/lastShown.ts). */
interface ShownSteps {
  access: StepsAccess;
  steps: number | null;
  average: number | null;
  /** The day it was read (toDateString), so yesterday's count never shows as today's. */
  day: string;
}
const SHOWN_KEY = 'feed.steps';

/** How many days are read for the average: the 7 before today, and today. */
const AVERAGE_DAYS = 8;

/**
 * Today's steps for Feed's Daily Steps widget, beside the greeting -- and the 7-day average its
 * bar measures today against. Read from Apple Health on the phone each time Feed is shown (Feed
 * calls `refresh` on every focus, its first included) and when the app comes back to the front --
 * it's a local read, so nothing is cached -- and today's count is handed to the Home Screen's
 * Steps widget as it's read. A reopened Feed starts from what it last showed today, so the widget
 * is there at once while it's read again.
 */
export function useStepsToday(userId?: string): StepsToday {
  const [shown] = useState(() => {
    const last = recallShown<ShownSteps>(userId, SHOWN_KEY);
    return last && last.day === new Date().toDateString() ? last : null;
  });
  const [access, setAccess] = useState<StepsAccess | null>(shown?.access ?? null);
  const [steps, setSteps] = useState<number | null>(shown?.steps ?? null);
  const [average, setAverage] = useState<number | null>(shown?.average ?? null);
  const [connecting, setConnecting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const mounted = useRef(true);

  const failed = useCallback((error: unknown) => {
    recordQuietFailure('health.steps', error);
    if (mounted.current && Platform.OS === 'ios') {
      setFailure(error instanceof Error ? error.message || error.name : String(error));
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const nextAccess = await stepsAccess();
      if (!mounted.current) return;
      setAccess(nextAccess);
      setFailure(null);
      const day = new Date().toDateString();
      if (nextAccess === 'unavailable') return;
      if (nextAccess === 'notAsked') {
        rememberShown<ShownSteps>(userId, SHOWN_KEY, {
          access: nextAccess,
          steps: null,
          average: null,
          day,
        });
        void showStepsWidget(null);
        return;
      }
      const count = await stepsToday();
      if (!mounted.current) return;
      setSteps(count);
      void showStepsWidget(count);
      // The average is extra: a failure leaves the count as it is, with no bar.
      let nextAverage: number | null = null;
      try {
        const days = await stepsByDay(AVERAGE_DAYS);
        const before = days.slice(0, -1);
        nextAverage = Math.round(before.reduce((sum, d) => sum + d.steps, 0) / before.length);
      } catch (error) {
        recordQuietFailure('health.steps.average', error);
      }
      if (!mounted.current) return;
      setAverage(nextAverage);
      rememberShown<ShownSteps>(userId, SHOWN_KEY, {
        access: nextAccess,
        steps: count,
        average: nextAverage,
        day,
      });
    } catch (error) {
      // Feed goes on; the widget says what went wrong.
      failed(error);
    }
  }, [failed, userId]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await askForSteps();
      await refresh();
    } catch (error) {
      failed(error);
    } finally {
      if (mounted.current) setConnecting(false);
    }
  }, [refresh, failed]);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [refresh]);

  return { access, steps, average, connecting, failure, refresh, connect };
}
