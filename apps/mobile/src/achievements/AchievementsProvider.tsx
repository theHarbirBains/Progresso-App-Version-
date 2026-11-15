import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { useFoodLog } from '../nutrition/FoodLogProvider';
import { useProfile } from '../profile/ProfileProvider';
import { useAllTimeStats } from '../progress/AllTimeStatsProvider';
import {
  awardMyAchievements,
  fetchAchievementDefinitions,
  fetchAchievementsSeenAt,
  fetchMyAwards,
  fetchMyProgress,
  markAchievementsSeen,
  type AchievementAward,
  type AchievementDefinition,
  type AchievementProgressRow,
} from './achievementQueries';
import { lifetimePoints } from './achievementProgress';
import { AchievementsContext, type UnlockBatch } from './achievementsContext';

/** How long after the last change to the shared caches the server is asked to award. */
const SETTLE_MS = 1500;

const keyOf = (award: AchievementAward) => `${award.achievementId}:${award.level}`;

/**
 * The signed-in person's achievements. The catalogue, their awards and progress are read as
 * they sign in; then the server is asked to award every level they've reached
 * (award_my_achievements -- only the server ever awards) as they sign in, whenever the app comes
 * back to the front, as onboarding finishes (a tracked history may just have been claimed), and
 * a moment after the shared workout, record or food caches change. After each run their awards
 * and progress are read again -- so awards the server made while they were away (overnight, as a
 * friend opened their profile, as they claimed a tracked history) come in too -- and every award
 * newer than the last one they were shown (users.achievements_seen_at) is queued to be shown
 * (AchievementUnlockHost); once it's been shown, that's remembered on the server. Reset on
 * sign-out.
 */
export function AchievementsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const { allWorkouts, repPRs } = useAllTimeStats();
  const { logs } = useFoodLog();
  const { profile } = useProfile();
  const onboarded = profile?.onboardingCompletedAt ?? null;

  const [definitions, setDefinitions] = useState<AchievementDefinition[]>([]);
  const [awards, setAwards] = useState<AchievementAward[]>([]);
  const [progress, setProgress] = useState<AchievementProgressRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unlocks, setUnlocks] = useState<UnlockBatch[]>([]);

  // The latest of each, for the award run to read without re-subscribing.
  const latest = useRef<{ definitions: AchievementDefinition[]; userId: string | undefined }>({
    definitions,
    userId,
  });
  latest.current = { definitions, userId };
  const running = useRef(false);
  const again = useRef(false);
  const ready = useRef(false);
  // The latest award shown, and every award already queued to be.
  const seenAt = useRef<number>(-Infinity);
  const queued = useRef(new Set<string>());

  /** Queues every award newer than the last shown, not queued yet, as one unlock. */
  const queueUnseen = useCallback((all: AchievementAward[]) => {
    const unseen = all.filter(
      (award) => Date.parse(award.awardedAt) > seenAt.current && !queued.current.has(keyOf(award)),
    );
    if (unseen.length === 0) return;
    unseen.forEach((award) => queued.current.add(keyOf(award)));
    const byId = new Map(latest.current.definitions.map((d) => [d.id, d]));
    const total = lifetimePoints(all);
    setUnlocks((prev) => [
      ...prev,
      {
        id: `${unseen.at(-1)!.awardedAt}-${prev.length}`,
        awards: unseen
          .map((award) => ({ award, definition: byId.get(award.achievementId) }))
          .filter(
            (item): item is { award: AchievementAward; definition: AchievementDefinition } =>
              item.definition !== undefined,
          ),
        pointsBefore: total - lifetimePoints(unseen),
        pointsAfter: total,
      },
    ]);
  }, []);

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
        const forUser: string | undefined = latest.current.userId;
        if (!forUser) return;
        await awardMyAchievements();
        const [mine, standing] = await Promise.all([
          fetchMyAwards(forUser),
          fetchMyProgress(forUser),
        ]);
        if (latest.current.userId !== forUser) return;
        setAwards(mine);
        setProgress(standing);
        queueUnseen(mine);
      } while (again.current);
    } catch {
      // Awarding is retried at the next change or the next return to the front -- and never
      // awards twice.
    } finally {
      running.current = false;
    }
  }, [queueUnseen]);

  // Sign-in: read everything, show what's new since last time, then award.
  useEffect(() => {
    ready.current = false;
    seenAt.current = -Infinity;
    queued.current = new Set();
    setDefinitions([]);
    setAwards([]);
    setProgress([]);
    setUnlocks([]);
    setError(null);
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [catalogue, mine, standing, seen] = await Promise.all([
          fetchAchievementDefinitions(),
          fetchMyAwards(userId),
          fetchMyProgress(userId),
          fetchAchievementsSeenAt(userId),
        ]);
        if (cancelled) return;
        latest.current = { definitions: catalogue, userId };
        seenAt.current = seen ? Date.parse(seen) : -Infinity;
        setDefinitions(catalogue);
        setAwards(mine);
        setProgress(standing);
        queueUnseen(mine);
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
  }, [userId, evaluate, queueUnseen]);

  // Back to the front: award what's come in meanwhile (a like, a follow back).
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void evaluate();
    });
    return () => subscription.remove();
  }, [evaluate]);

  // A moment after the shared caches change -- a workout finished, a record set, a food logged
  // -- or onboarding finishes.
  const changed = useRef(false);
  useEffect(() => {
    if (!changed.current) {
      changed.current = true;
      return;
    }
    const timer = setTimeout(() => void evaluate(), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [allWorkouts, repPRs, logs, onboarded, evaluate]);

  const shownFirst = useRef<UnlockBatch | undefined>(undefined);
  shownFirst.current = unlocks[0];
  const dismissUnlock = useCallback(() => {
    const shown = shownFirst.current;
    if (shown) {
      const until = shown.awards.reduce(
        (latestAt, { award }) => Math.max(latestAt, Date.parse(award.awardedAt)),
        seenAt.current,
      );
      if (Number.isFinite(until) && until > seenAt.current) {
        seenAt.current = until;
        // Remembered on the server, so it's never shown again -- here or on another phone.
        void markAchievementsSeen(new Date(until).toISOString()).catch(() => undefined);
      }
    }
    setUnlocks((prev) => prev.slice(1));
  }, []);

  const value = useMemo(
    () => ({
      definitions,
      awards,
      progress,
      points: lifetimePoints(awards),
      loading,
      error,
      evaluate,
      unlocks,
      dismissUnlock,
    }),
    [definitions, awards, progress, loading, error, evaluate, unlocks, dismissUnlock],
  );

  return <AchievementsContext.Provider value={value}>{children}</AchievementsContext.Provider>;
}
