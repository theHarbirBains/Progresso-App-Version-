import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import {
  awardMyAchievements,
  fetchAchievementDefinitions,
  fetchMyAchievementMetrics,
  fetchMyAwards,
  type AchievementAward,
  type AchievementDefinition,
  type AchievementMetrics,
} from './achievementQueries';
import { lifetimePoints } from './achievementProgress';
import { AchievementsContext, type UnlockBatch } from './achievementsContext';

/** How long after the last change to the shared caches the server is asked to award. */
const SETTLE_MS = 1500;

/**
 * The signed-in person's achievements. The catalogue, their awards and figures are read once
 * as they sign in; then the server is asked to award what they've reached
 * (award_my_achievements -- the only thing that ever awards) as they sign in, whenever the app
 * comes back to the front, and a moment after the shared workout, record or food caches change
 * (a workout finished, a food logged). What it newly awards is added to their awards and queued
 * to be shown (AchievementUnlockHost), and their figures are read again. Reset on sign-out.
 */
export function AchievementsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { allWorkouts, repPRs } = useAllTimeStats();
  const { logs } = useFoodLog();

  const [definitions, setDefinitions] = useState<AchievementDefinition[]>([]);
  const [awards, setAwards] = useState<AchievementAward[]>([]);
  const [metrics, setMetrics] = useState<AchievementMetrics>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocks, setUnlocks] = useState<UnlockBatch[]>([]);

  // The latest of each, for the award run to read without re-subscribing.
  const latest = useRef({ definitions, awards, userId });
  latest.current = { definitions, awards, userId };
  const running = useRef(false);
  const again = useRef(false);
  const ready = useRef(false);

  const evaluate = useCallback(async () => {
    if (!latest.current.userId || !ready.current) return;
    if (running.current) {
      again.current = true;
      return;
    }
    running.current = true;
    try {
      do {
        again.current = false;
        const forUser = latest.current.userId;
        const fresh = await awardMyAchievements();
        if (latest.current.userId !== forUser) return;
        if (fresh.length > 0) {
          const before = lifetimePoints(latest.current.awards);
          const byId = new Map(latest.current.definitions.map((d) => [d.id, d]));
          latest.current = { ...latest.current, awards: [...latest.current.awards, ...fresh] };
          setAwards((prev) => [...prev, ...fresh]);
          setUnlocks((prev) => [
            ...prev,
            {
              id: `${fresh[0]!.awardedAt}-${prev.length}`,
              awards: fresh
                .map((award) => ({ award, definition: byId.get(award.achievementId) }))
                .filter(
                  (item): item is { award: AchievementAward; definition: AchievementDefinition } =>
                    item.definition !== undefined,
                ),
              pointsBefore: before,
              pointsAfter: before + lifetimePoints(fresh),
            },
          ]);
        }
        setMetrics(await fetchMyAchievementMetrics());
      } while (again.current);
    } catch {
      // Awarding is retried at the next change or the next return to the front -- and never
      // awards twice.
    } finally {
      running.current = false;
    }
  }, []);

  // Sign-in: read everything once, then award.
  useEffect(() => {
    ready.current = false;
    setDefinitions([]);
    setAwards([]);
    setMetrics({});
    setUnlocks([]);
    setError(null);
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [catalogue, mine, figures] = await Promise.all([
          fetchAchievementDefinitions(),
          fetchMyAwards(userId),
          fetchMyAchievementMetrics(),
        ]);
        if (cancelled) return;
        latest.current = { definitions: catalogue, awards: mine, userId };
        setDefinitions(catalogue);
        setAwards(mine);
        setMetrics(figures);
        ready.current = true;
      } catch (err) {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Could not load achievements');
      } finally {
        if (!cancelled) setLoading(false);
      }
      if (!cancelled && ready.current) await evaluate();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, evaluate]);

  // Back to the front: award what's come in meanwhile (a like, a follow back).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void evaluate();
    });
    return () => subscription.remove();
  }, [evaluate]);

  // A moment after the shared caches change: a workout finished, a record set, a food logged.
  const seen = useRef(false);
  useEffect(() => {
    if (!seen.current) {
      seen.current = true;
      return;
    }
    const timer = setTimeout(() => void evaluate(), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [allWorkouts, repPRs, logs, evaluate]);

  const dismissUnlock = useCallback(() => setUnlocks((prev) => prev.slice(1)), []);

  const value = useMemo(
    () => ({
      definitions,
      awards,
      metrics,
      points: lifetimePoints(awards),
      loading,
      error,
      evaluate,
      unlocks,
      dismissUnlock,
    }),
    [definitions, awards, metrics, loading, error, evaluate, unlocks, dismissUnlock],
  );

  return <AchievementsContext.Provider value={value}>{children}</AchievementsContext.Provider>;
}
