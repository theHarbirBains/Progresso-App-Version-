import {
  enrichWorkoutSummaries,
  type EnrichedWorkoutSummary,
} from '../workouts/workoutHistoryEnrichment';
import { fetchWorkoutHistory } from '../workouts/workoutQueries';
import { fetchWeeklyFoodLogs, type FoodLogRow } from '../nutrition/foodLogQueries';

const WORKOUT_PAGE_SIZE = 20;

export type FeedItem =
  | { kind: 'workout'; id: string; timestamp: string; workout: EnrichedWorkoutSummary }
  | { kind: 'foodLog'; id: string; timestamp: string; log: FoodLogRow };

export interface FeedPage {
  items: FeedItem[];
  /** Whether an older page of workouts exists -- drives Feed's Load More. */
  hasMore: boolean;
}

/**
 * The Feed tab's one data source: the user's own completed workouts and
 * logged foods, merged into a single reverse-chronological list -- "what did
 * I actually do", never anyone else's data (there is no following/social
 * graph yet -- see DESIGN.md's Feed section). Two existing queries, no new
 * tables:
 *
 * - Workouts: the same paginated history WorkoutHistoryScreen's own list
 *   already fetches (`fetchWorkoutHistory` + `enrichWorkoutSummaries`), so a
 *   workout card can show its muscle groups, sets and volume without a
 *   second round trip per item. `page` (0-based) lets Feed load further back
 *   -- see `hasMore`.
 * - Food logs: the current week's logs (`fetchWeeklyFoodLogs`) -- the same
 *   week boundary Nutrition Today's own weekly widgets use. Only fetched on
 *   `page` 0: there is no paginated food-log-history query yet, so scrolling
 *   further back surfaces older workouts only, never older food logs. A
 *   dedicated paginated food history is a future enhancement, not required
 *   to make Feed usable.
 *
 * Never throws for a partial failure: if one source fails, the feed still
 * shows what the other returned (same "degrade gracefully" pattern the food
 * search backend uses for its external provider).
 */
export async function fetchFeedItems(userId: string, page = 0): Promise<FeedPage> {
  const [workoutsResult, foodLogsResult] = await Promise.allSettled([
    fetchWorkoutHistory(userId, page, WORKOUT_PAGE_SIZE),
    page === 0 ? fetchWeeklyFoodLogs(userId) : Promise.resolve<FoodLogRow[]>([]),
  ]);

  const items: FeedItem[] = [];
  let hasMore = false;

  if (workoutsResult.status === 'fulfilled') {
    hasMore = workoutsResult.value.hasMore;
    const enriched = await enrichWorkoutSummaries(workoutsResult.value.rows);
    for (const workout of enriched) {
      // A workout only belongs in the feed once it's actually finished --
      // an in-progress one has no completedAt yet and shouldn't appear as
      // something "done".
      if (!workout.completedAt) continue;
      items.push({
        kind: 'workout',
        id: `workout-${workout.id}`,
        timestamp: workout.completedAt,
        workout,
      });
    }
  }

  if (foodLogsResult.status === 'fulfilled') {
    for (const log of foodLogsResult.value) {
      items.push({ kind: 'foodLog', id: `foodLog-${log.id}`, timestamp: log.loggedAt, log });
    }
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return { items, hasMore };
}
