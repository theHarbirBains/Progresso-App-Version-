import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { recordQuietFailure } from '../lib/sentry';
import { showStepsWidget } from '../widgets/widgetUpdates';
import { askForSteps, stepsAccess, stepsToday, type StepsAccess } from './steps';

export interface StepsToday {
  /** Null until it's known; 'unavailable' off iPhone. */
  access: StepsAccess | null;
  /** Today's count once asked, else null. */
  steps: number | null;
  connecting: boolean;
  /** Reads the count again -- Feed calls it each time it's shown. */
  refresh: () => Promise<void>;
  /** Asks Apple Health for steps, then reads them. */
  connect: () => Promise<void>;
}

/**
 * Today's steps for Feed's Steps card. Read from Apple Health on the phone each time Feed is
 * shown (Feed calls `refresh` on every focus, its first included) and when the app comes back to
 * the front -- it's a local read, so nothing is cached -- and handed to the Steps widget as it's
 * read.
 */
export function useStepsToday(): StepsToday {
  const [access, setAccess] = useState<StepsAccess | null>(null);
  const [steps, setSteps] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const nextAccess = await stepsAccess();
      if (!mounted.current) return;
      setAccess(nextAccess);
      if (nextAccess === 'unavailable') return;
      if (nextAccess === 'notAsked') {
        showStepsWidget(null);
        return;
      }
      const count = await stepsToday();
      if (!mounted.current) return;
      setSteps(count);
      showStepsWidget(count);
    } catch (error) {
      // The card keeps what it last showed; Feed goes on.
      recordQuietFailure('health.steps', error);
    }
  }, []);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      await askForSteps();
      await refresh();
    } catch (error) {
      recordQuietFailure('health.steps', error);
    } finally {
      if (mounted.current) setConnecting(false);
    }
  }, [refresh]);

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

  return { access, steps, connecting, refresh, connect };
}
