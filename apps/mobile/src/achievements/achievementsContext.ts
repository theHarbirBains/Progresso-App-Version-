import { createContext, useContext } from 'react';
import type {
  AchievementAward,
  AchievementDefinition,
  AchievementMetrics,
} from './achievementQueries';

// The signed-in person's achievements as every component reads them. Kept apart from
// AchievementsProvider (which reads Supabase), so a component that only shows them never pulls
// the database client in with it -- the same split as the app theme and membership.

/** Awards that came in together, to show as one unlock -- with the AP before and after. */
export interface UnlockBatch {
  id: string;
  awards: { award: AchievementAward; definition: AchievementDefinition }[];
  pointsBefore: number;
  pointsAfter: number;
}

export interface AchievementsValue {
  definitions: AchievementDefinition[];
  awards: AchievementAward[];
  metrics: AchievementMetrics;
  /** Lifetime AP: the sum of every award. */
  points: number;
  loading: boolean;
  error: string | null;
  /** Asks the server to award whatever's been reached since. */
  evaluate: () => Promise<void>;
  /** Unlocks waiting to be shown, oldest first. */
  unlocks: UnlockBatch[];
  dismissUnlock: () => void;
}

/** Without a provider (a test, a component on its own): nothing earned, nothing to do. */
export const AchievementsContext = createContext<AchievementsValue>({
  definitions: [],
  awards: [],
  metrics: {},
  points: 0,
  loading: false,
  error: null,
  evaluate: async () => undefined,
  unlocks: [],
  dismissUnlock: () => undefined,
});

export function useAchievements(): AchievementsValue {
  return useContext(AchievementsContext);
}
