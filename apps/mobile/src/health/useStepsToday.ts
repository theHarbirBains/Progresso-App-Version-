import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { recallShown, rememberShown } from '../lib/lastShown';
import { recordQuietFailure } from '../lib/sentry';
import { showStepsWidget } from '../widgets/widgetUpdates';
import { askForSteps, stepsAccess, stepsToday, type StepsAccess } from './steps';

export interface StepsToday {
  /** Null until it's known; 'unavailable' off iPhone. */
  access: StepsAccess | null;
  /** Today's count once asked, else null. */
  steps: number | null;
  connecting: boolean;
  /** Why Apple Health couldn't be reached, when it couldn't -- shown on the card, not hidden. */
  failure: string | null;
  /** Reads the count again -- Progress calls it each time it's shown. */
  refresh: () => Promise<void>;
  /** Asks Apple Health for steps, then reads them. */
  connect: () => Promise<void>;
}

/** What Progress last showed of today's steps, for `userId` (lib/lastShown.ts). */
interface ShownSteps {
  access: StepsAccess;
  steps: number | null;
  /** The day it was read (toDateString), so yesterday's count never shows as today's. */
  day: string;
}
const SHOWN_KEY = 'progress.steps';

/**
 * Today's steps for the Steps block at the top of Progress's Overview. Read from Apple Health on
 * the phone each time Progress is shown (it calls `refresh` as it opens and on every focus after)
 * and when the app comes back to the front -- it's a local read, so nothing is cached -- and
 * handed to the Steps widget as it's read. A reopened Progress starts from what it last showed
 * today, so the block is there at once while it's read again.
 */
export function useStepsToday(userId?: string): StepsToday {
  const [shown] = useState(() => {
    const last = recallShown<ShownSteps>(userId, SHOWN_KEY);
    return last && last.day === new Date().toDateString() ? last : null;
  });
  const [access, setAccess] = useState<StepsAccess | null>(shown?.access ?? null);
  const [steps, setSteps] = useState<number | null>(shown?.steps ?? null);
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
        rememberShown<ShownSteps>(userId, SHOWN_KEY, { access: nextAccess, steps: null, day });
        void showStepsWidget(null);
        return;
      }
      const count = await stepsToday();
      if (!mounted.current) return;
      setSteps(count);
      rememberShown<ShownSteps>(userId, SHOWN_KEY, { access: nextAccess, steps: count, day });
      void showStepsWidget(count);
    } catch (error) {
      // Progress goes on; the block says what went wrong.
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

  return { access, steps, connecting, failure, refresh, connect };
}
