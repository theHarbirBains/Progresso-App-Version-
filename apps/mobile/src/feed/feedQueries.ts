import {
  enrichWorkoutSummaries,
  type EnrichedWorkoutSummary,
} from '../workouts/workoutHistoryEnrichment';
import { fetchWorkoutHistory } from '../workouts/workoutQueries';

const WORKOUT_PAGE_SIZE = 20;

export type FeedItem = {
  kind: 'workout';
  id: string;
  timestamp: string;
  workout: EnrichedWorkoutSummary;
};

export interface FeedPage {
  items: FeedItem[];
  /** Whether an older page of workouts exists -- drives Feed's Load More. */
  hasMore: boolean;
}

/**
 * The Feed tab's one data source: the user's own completed workouts,
 * reverse-chronological -- "what did I actually do", never anyone else's
 * data (there is no following/social graph yet -- see DESIGN.md's Feed
 * section). The same paginated history WorkoutHistoryScreen's own list
 * already fetches (`fetchWorkoutHistory` + `enrichWorkoutSummaries`), so a
 * workout card can show its muscle groups, sets and volume without a second
 * round trip per item. `page` (0-based) lets Feed load further back -- see
 * `hasMore`.
 *
 * Nutrition logs are deliberately not part of Feed -- see Nutrition
 * Today/History for logged food instead.
 *
 * Never throws for a failure: an empty page comes back instead, same
 * "degrade gracefully" philosophy the rest of Feed's loading uses.
 */
export async function fetchFeedItems(userId: string, page = 0): Promise<FeedPage> {
  const items: FeedItem[] = [];
  let hasMore = false;

  try {
    const { rows, hasMore: more } = await fetchWorkoutHistory(userId, page, WORKOUT_PAGE_SIZE);
    hasMore = more;
    const enriched = await enrichWorkoutSummaries(rows);
    for (const workout of enriched) {
      // A workout only belongs in the feed once it's actually finished --
      // an in-progress one has no completedAt yet and shouldn't appear as
      // something "done".
      if (!workout.completedAt) continue;
      items.push({
        kind: 'workout',
        id: `workout-${workout.id}`,
        // performedAt, not completedAt -- the date a workout is attributed
        // to is editable after the fact (see EditWorkoutScreen), while
        // completedAt is a "this is done" marker whose own value doesn't
        // move with an edit. Every other workout query (own history, the
        // calendar, PR ordering) already sorts/filters by performed_at;
        // this keeps Feed consistent with that rather than silently
        // showing a stale position/date after a workout is moved.
        timestamp: workout.performedAt,
        workout,
      });
    }
  } catch {
    // Degrade to an empty page rather than throw -- same philosophy as
    // the rest of Feed's loading (a failed source never blocks the screen).
  }

  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return { items, hasMore };
}
