import { FollowsService } from '../follows/follows.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { FeedService } from './feed.service';

interface QueuedResult {
  data: unknown;
  error: { message: string } | null;
}

const CHAIN_METHODS = ['select', 'eq', 'in', 'not', 'is', 'order', 'range', 'limit'] as const;

/** Same generic per-table FIFO query-builder mock as follows.service.spec.ts -- see that file's comment for why a shape-agnostic mock is used here instead of hand-rolled exact chains. */
function createMockClient() {
  const queues = new Map<string, QueuedResult[]>();

  function queue(table: string, result: QueuedResult) {
    const existing = queues.get(table) ?? [];
    existing.push(result);
    queues.set(table, existing);
  }

  function nextResult(table: string): QueuedResult {
    const list = queues.get(table);
    const result = list?.shift();
    if (!result) throw new Error(`No queued result for table "${table}"`);
    return result;
  }

  function makeBuilder(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {};
    for (const method of CHAIN_METHODS) {
      builder[method] = jest.fn(() => builder);
    }
    builder.then = (
      onFulfilled: (r: QueuedResult) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(nextResult(table)).then(onFulfilled, onRejected);
    return builder;
  }

  const from = jest.fn((table: string) => makeBuilder(table));
  return { from, queue };
}

function serviceWith(client: ReturnType<typeof createMockClient>): FeedService {
  const supabaseService = { getClient: () => client } as unknown as SupabaseService;
  const followsService = new FollowsService(supabaseService);
  return new FeedService(supabaseService, followsService);
}

describe('FeedService', () => {
  describe('getFriendsFeed', () => {
    it('returns an empty page without querying anything else when the user follows nobody', async () => {
      const client = createMockClient();
      client.queue('follows', { data: [], error: null });
      const service = serviceWith(client);

      await expect(service.getFriendsFeed('user-1', 0)).resolves.toEqual({
        items: [],
        hasMore: false,
      });
    });

    it("merges followees' workouts and food logs, newest first, annotated with the author", async () => {
      const client = createMockClient();
      client.queue('follows', { data: [{ followee_id: 'user-2' }], error: null });
      client.queue('workouts', {
        data: [
          {
            id: 'w1',
            user_id: 'user-2',
            name: 'Push Day',
            performed_at: '2026-09-20T10:00:00.000Z',
            completed_at: '2026-09-20T11:00:00.000Z',
            workout_split_day_id: null,
          },
        ],
        error: null,
      });
      client.queue('workout_exercises', { data: [], error: null });
      client.queue('food_logs', {
        data: [
          {
            id: 'f1',
            user_id: 'user-2',
            food_name_snapshot: 'Chicken Rice',
            calories: 600,
            protein_g: 50,
            carbs_g: 60,
            fat_g: 10,
            meal_type: 'lunch',
            image_url: null,
            logged_at: '2026-09-21T12:00:00.000Z',
          },
        ],
        error: null,
      });
      client.queue('users', {
        data: [{ id: 'user-2', username: 'jane', display_name: 'Jane', avatar_url: null }],
        error: null,
      });
      const service = serviceWith(client);

      const result = await service.getFriendsFeed('user-1', 0);

      expect(result.hasMore).toBe(false);
      expect(result.items).toHaveLength(2);
      // Newest first: the food log (Sep 21) before the workout (Sep 20).
      expect(result.items[0]).toMatchObject({ kind: 'foodLog', id: 'foodLog-f1' });
      expect(result.items[1]).toMatchObject({ kind: 'workout', id: 'workout-w1' });
      for (const item of result.items) {
        expect(item.author).toEqual({
          id: 'user-2',
          username: 'jane',
          displayName: 'Jane',
          avatarUrl: null,
        });
      }
    });

    it('skips food logs on pages after the first', async () => {
      const client = createMockClient();
      client.queue('follows', { data: [{ followee_id: 'user-2' }], error: null });
      client.queue('workouts', { data: [], error: null });
      const service = serviceWith(client);

      const result = await service.getFriendsFeed('user-1', 1);

      expect(result.items).toEqual([]);
    });

    it('flags hasMore when a full page of workouts comes back', async () => {
      const client = createMockClient();
      client.queue('follows', { data: [{ followee_id: 'user-2' }], error: null });
      const fullPage = Array.from({ length: 20 }, (_, i) => ({
        id: `w${i}`,
        user_id: 'user-2',
        name: 'Workout',
        performed_at: '2026-09-20T10:00:00.000Z',
        completed_at: '2026-09-20T11:00:00.000Z',
        workout_split_day_id: null,
      }));
      client.queue('workouts', { data: fullPage, error: null });
      client.queue('workout_exercises', { data: [], error: null });
      client.queue('food_logs', { data: [], error: null });
      client.queue('users', {
        data: [{ id: 'user-2', username: 'jane', display_name: 'Jane', avatar_url: null }],
        error: null,
      });
      const service = serviceWith(client);

      const result = await service.getFriendsFeed('user-1', 0);

      expect(result.hasMore).toBe(true);
      expect(result.items).toHaveLength(20);
    });
  });
});
