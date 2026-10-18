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

    it("merges followees' workouts, newest first, annotated with the author", async () => {
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
      client.queue('users', {
        data: [{ id: 'user-2', username: 'jane', display_name: 'Jane', avatar_url: null }],
        error: null,
      });
      const service = serviceWith(client);

      const result = await service.getFriendsFeed('user-1', 0);

      expect(result.hasMore).toBe(false);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({ kind: 'workout', id: 'workout-w1' });
      for (const item of result.items) {
        expect(item.author).toEqual({
          id: 'user-2',
          username: 'jane',
          displayName: 'Jane',
          avatarUrl: null,
        });
      }
    });

    it("timestamps a workout by performed_at, not completed_at -- so editing a workout's date (EditWorkoutScreen) moves it in Feed too", async () => {
      const client = createMockClient();
      client.queue('follows', { data: [{ followee_id: 'user-2' }], error: null });
      client.queue('workouts', {
        data: [
          {
            id: 'w1',
            user_id: 'user-2',
            name: 'Push Day',
            // Deliberately the opposite order from completed_at: if the bug
            // regressed (timestamping by completed_at again), this would
            // report the wrong date.
            performed_at: '2026-09-25T10:00:00.000Z',
            completed_at: '2026-09-20T11:00:00.000Z',
            workout_split_day_id: null,
          },
        ],
        error: null,
      });
      client.queue('workout_exercises', { data: [], error: null });
      client.queue('users', {
        data: [{ id: 'user-2', username: 'jane', display_name: 'Jane', avatar_url: null }],
        error: null,
      });
      const service = serviceWith(client);

      const result = await service.getFriendsFeed('user-1', 0);

      expect(result.items[0]).toMatchObject({
        id: 'workout-w1',
        timestamp: '2026-09-25T10:00:00.000Z',
      });
    });

    it('gives each followee workout its completed-exercise count and per-exercise top sets, from its real sets', async () => {
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
      client.queue('workout_exercises', {
        data: [
          {
            id: 'we-bench',
            workout_id: 'w1',
            exercise_id: 'bench',
            order_index: 1,
            exercises: { name: 'Bench Press', photo_url: 'https://example.com/bench.jpg' },
          },
          {
            id: 'we-curl',
            workout_id: 'w1',
            exercise_id: 'curl',
            order_index: 2,
            exercises: { name: 'Curl', photo_url: null },
          },
          {
            id: 'we-empty',
            workout_id: 'w1',
            exercise_id: 'empty',
            order_index: 3,
            exercises: { name: 'Row' },
          },
        ],
        error: null,
      });
      client.queue('sets', {
        data: [
          { id: 's1', workout_exercise_id: 'we-bench', set_index: 1, weight_kg: 200, reps: 5 },
          { id: 's2', workout_exercise_id: 'we-bench', set_index: 2, weight_kg: 225, reps: 8 },
          { id: 's3', workout_exercise_id: 'we-curl', set_index: 1, weight_kg: 30, reps: 10 },
        ],
        error: null,
      });
      client.queue('users', {
        data: [{ id: 'user-2', username: 'jane', display_name: 'Jane', avatar_url: null }],
        error: null,
      });
      const service = serviceWith(client);

      const result = await service.getFriendsFeed('user-1', 0);

      expect(result.items[0]).toMatchObject({
        kind: 'workout',
        workout: {
          completedExerciseCount: 2,
          topSets: [
            {
              exerciseId: 'bench',
              exerciseName: 'Bench Press',
              photoUrl: 'https://example.com/bench.jpg',
              weightKg: 225,
              reps: 8,
            },
            { exerciseId: 'curl', exerciseName: 'Curl', photoUrl: null, weightKg: 30, reps: 10 },
          ],
        },
      });
    });

    it('gives a bodyweight exercise its most reps and a timed one its longest, with volume from weighted sets only', async () => {
      const client = createMockClient();
      client.queue('follows', { data: [{ followee_id: 'user-2' }], error: null });
      client.queue('workouts', {
        data: [
          {
            id: 'w1',
            user_id: 'user-2',
            name: 'Mixed',
            performed_at: '2026-09-20T10:00:00.000Z',
            completed_at: '2026-09-20T11:00:00.000Z',
            workout_split_day_id: null,
          },
        ],
        error: null,
      });
      client.queue('workout_exercises', {
        data: [
          {
            id: 'we-bench',
            workout_id: 'w1',
            exercise_id: 'bench',
            order_index: 1,
            measurement_type: 'weight_reps',
            exercises: { name: 'Bench Press', photo_url: null },
          },
          {
            id: 'we-pushup',
            workout_id: 'w1',
            exercise_id: 'pushup',
            order_index: 2,
            measurement_type: 'bodyweight',
            exercises: { name: 'Push-Up', photo_url: null },
          },
          {
            id: 'we-plank',
            workout_id: 'w1',
            exercise_id: 'plank',
            order_index: 3,
            measurement_type: 'timed',
            exercises: { name: 'Plank', photo_url: null },
          },
        ],
        error: null,
      });
      const set = (id: string, we: string, index: number, values: object) => ({
        id,
        workout_exercise_id: we,
        set_index: index,
        weight_kg: null,
        reps: null,
        duration_seconds: null,
        ...values,
      });
      client.queue('sets', {
        data: [
          set('s1', 'we-bench', 1, { weight_kg: 100, reps: 5 }),
          // A weighted set with no weight isn't a logged set.
          set('s2', 'we-bench', 2, { reps: 5 }),
          // An older app may have sent a weight with push-ups: reps only, and no volume.
          set('s3', 'we-pushup', 1, { weight_kg: 80, reps: 20 }),
          set('s4', 'we-pushup', 2, { reps: 25 }),
          set('s5', 'we-plank', 1, { duration_seconds: 60 }),
          set('s6', 'we-plank', 2, { duration_seconds: 90 }),
          // A timed set with no time isn't a logged set.
          set('s7', 'we-plank', 3, {}),
        ],
        error: null,
      });
      client.queue('users', {
        data: [{ id: 'user-2', username: 'jane', display_name: 'Jane', avatar_url: null }],
        error: null,
      });
      const service = serviceWith(client);

      const result = await service.getFriendsFeed('user-1', 0);

      expect(result.items[0]?.workout).toMatchObject({
        completedSetCount: 5,
        totalVolumeKg: 500,
        completedExerciseCount: 3,
        topSets: [
          {
            exerciseId: 'bench',
            measurementType: 'weight_reps',
            weightKg: 100,
            reps: 5,
            durationSeconds: null,
          },
          {
            exerciseId: 'pushup',
            measurementType: 'bodyweight',
            weightKg: null,
            reps: 25,
            durationSeconds: null,
          },
          {
            exerciseId: 'plank',
            measurementType: 'timed',
            weightKg: null,
            reps: null,
            durationSeconds: 90,
          },
        ],
      });
    });

    it('leaves workouts a trainer logged for a client out of the friends feed', async () => {
      const client = createMockClient();
      client.queue('follows', { data: [{ followee_id: 'user-2' }], error: null });
      client.queue('workouts', { data: [], error: null });
      const service = serviceWith(client);

      await service.getFriendsFeed('user-1', 0);

      const workoutsIndex = client.from.mock.calls.findIndex(([table]) => table === 'workouts');
      const workoutsBuilder = client.from.mock.results[workoutsIndex]?.value;
      expect(workoutsBuilder.is).toHaveBeenCalledWith('logged_by', null);
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
