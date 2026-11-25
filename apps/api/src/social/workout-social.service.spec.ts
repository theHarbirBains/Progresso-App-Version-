import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FollowsService } from '../follows/follows.service';
import type { SocialPushService } from '../notifications/social-push.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { WorkoutSocialService } from './workout-social.service';

interface QueuedResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

const CHAIN = ['select', 'eq', 'in', 'is', 'not', 'or', 'order', 'insert', 'delete'] as const;

/** Per-table FIFO results, as in the other specs, with every call recorded. */
function createMockClient() {
  const queues = new Map<string, QueuedResult[]>();
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const queue = (table: string, result: QueuedResult) => {
    queues.set(table, [...(queues.get(table) ?? []), result]);
  };
  const next = (table: string): QueuedResult => {
    const result = queues.get(table)?.shift();
    if (!result) throw new Error(`No queued result for "${table}"`);
    return result;
  };
  const builder = (table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    for (const method of CHAIN) {
      b[method] = jest.fn((...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      });
    }
    b.maybeSingle = jest.fn(async () => next(table));
    b.single = jest.fn(async () => next(table));
    b.then = (ok: (r: QueuedResult) => unknown, fail?: (e: unknown) => unknown) =>
      Promise.resolve(next(table)).then(ok, fail);
    return b;
  };
  return { from: jest.fn((table: string) => builder(table)), queue, calls };
}

const ME = '11111111-1111-1111-1111-111111111111';
const SAM = '22222222-2222-2222-2222-222222222222';
const W = '44444444-4444-4444-4444-444444444444';

function workout(extra: Record<string, unknown> = {}) {
  return {
    id: W,
    user_id: SAM,
    name: 'Pull Day',
    performed_at: '2026-11-10T10:00:00Z',
    completed_at: '2026-11-10T11:00:00Z',
    deleted_at: null,
    logged_by: null,
    ...extra,
  };
}

function setup() {
  const client = createMockClient();
  const supabaseService = { getClient: () => client } as unknown as SupabaseService;
  const push = {
    nameOf: jest.fn().mockResolvedValue('Harbir'),
    notify: jest.fn().mockResolvedValue(undefined),
  };
  const service = new WorkoutSocialService(
    supabaseService,
    new FollowsService(supabaseService),
    push as unknown as SocialPushService,
  );
  return { client, push, service };
}

/** ME follows SAM (accepted), and nobody's blocked. */
function queueFollowing(
  client: ReturnType<typeof createMockClient>,
  status = 'accepted',
  visibility: 'private' | 'public' = 'private',
) {
  client.queue('user_blocks', { data: [], error: null });
  client.queue('follows', {
    data: [{ id: 'f1', follower_id: ME, followee_id: SAM, status }],
    error: null,
  });
  client.queue('users', { data: { profile_visibility: visibility }, error: null });
}

describe('WorkoutSocialService', () => {
  describe('like', () => {
    it("likes a followed person's workout and pushes it to them", async () => {
      const { client, push, service } = setup();
      client.queue('workouts', { data: workout(), error: null });
      queueFollowing(client);
      client.queue('workout_likes', { data: null, error: null });

      await service.like(ME, W);

      expect(client.calls).toContainEqual({
        table: 'workout_likes',
        method: 'insert',
        args: [{ workout_id: W, user_id: ME }],
      });
      expect(push.notify).toHaveBeenCalledWith(SAM, 'likes', {
        title: 'New like',
        body: 'Harbir liked your workout Pull Day.',
        path: `workouts/${W}`,
      });
    });

    it("reaches a public profile's workout without a follow -- never a trainer's logging", async () => {
      const { client, service } = setup();
      client.queue('workouts', { data: workout(), error: null });
      queueFollowing(client, 'pending', 'public');
      client.queue('workout_likes', { data: null, error: null });
      await service.like(ME, W);
      expect(client.calls).toContainEqual({
        table: 'workout_likes',
        method: 'insert',
        args: [{ workout_id: W, user_id: ME }],
      });

      client.queue('workouts', { data: workout({ logged_by: 'coach' }), error: null });
      queueFollowing(client, 'pending', 'public');
      await expect(service.like(ME, W)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sends no second push for a workout already liked', async () => {
      const { client, push, service } = setup();
      client.queue('workouts', { data: workout(), error: null });
      queueFollowing(client);
      client.queue('workout_likes', { data: null, error: { code: '23505', message: 'dup' } });

      await service.like(ME, W);

      expect(push.notify).not.toHaveBeenCalled();
    });

    it('never pushes a like of your own workout', async () => {
      const { client, push, service } = setup();
      client.queue('workouts', { data: workout({ user_id: ME }), error: null });
      client.queue('workout_likes', { data: null, error: null });

      await service.like(ME, W);

      expect(push.notify).not.toHaveBeenCalled();
    });

    it("can't reach a workout a trainer logged, or one of someone you don't follow", async () => {
      const { client, service } = setup();
      client.queue('workouts', { data: workout({ logged_by: 'coach' }), error: null });
      queueFollowing(client);
      client.queue('workouts', { data: workout(), error: null });
      queueFollowing(client, 'pending');

      await expect(service.like(ME, W)).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.like(ME, W)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('comment', () => {
    it("posts a comment, trimmed, and pushes a short excerpt of it to the workout's owner", async () => {
      const { client, push, service } = setup();
      client.queue('workouts', { data: workout(), error: null });
      queueFollowing(client);
      client.queue('workout_comments', {
        data: { id: 'c1', created_at: '2026-11-11T00:00:00Z' },
        error: null,
      });
      client.queue('users', {
        data: [{ id: ME, username: 'harbir', display_name: 'Harbir', avatar_url: null }],
        error: null,
      });
      const long = 'Strong session! '.repeat(10);

      const comment = await service.comment(ME, W, `  ${long}  `);

      expect(comment).toMatchObject({ id: 'c1', body: long.trim(), canDelete: true });
      expect(push.notify).toHaveBeenCalledWith(
        SAM,
        'comments',
        expect.objectContaining({ title: 'Harbir commented', path: `workouts/${W}` }),
      );
      const sent = push.notify.mock.calls[0][2] as { body: string };
      expect(sent.body.length).toBeLessThanOrEqual(80);
      expect(sent.body.endsWith('…')).toBe(true);
    });
  });

  describe('deleteComment', () => {
    it("lets the workout's owner delete a comment on it, and nobody else's but its writer", async () => {
      const { client, service } = setup();
      client.queue('workout_comments', {
        data: { id: 'c1', user_id: SAM, workouts: { user_id: ME } },
        error: null,
      });
      client.queue('workout_comments', { data: null, error: null });
      client.queue('workout_comments', {
        data: { id: 'c2', user_id: SAM, workouts: { user_id: SAM } },
        error: null,
      });

      await service.deleteComment(ME, 'c1');
      await expect(service.deleteComment(ME, 'c2')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('getSocial', () => {
    it('lists likes and comments -- nothing from someone blocked -- saying which you can delete', async () => {
      const { client, service } = setup();
      client.queue('workouts', { data: workout(), error: null });
      queueFollowing(client);
      client.queue('workout_likes', {
        data: [{ user_id: ME }, { user_id: 'blocked-id' }],
        error: null,
      });
      client.queue('workout_comments', {
        data: [
          { id: 'c1', user_id: ME, body: 'Nice', created_at: '2026-11-11T00:00:00Z' },
          { id: 'c2', user_id: SAM, body: 'Thanks', created_at: '2026-11-11T01:00:00Z' },
          { id: 'c3', user_id: 'blocked-id', body: 'x', created_at: '2026-11-11T02:00:00Z' },
        ],
        error: null,
      });
      client.queue('user_blocks', {
        data: [{ blocker_id: ME, blocked_id: 'blocked-id' }],
        error: null,
      });
      client.queue('users', {
        data: [
          { id: ME, username: 'harbir', display_name: 'Harbir', avatar_url: null },
          { id: SAM, username: 'sam', display_name: 'Sam', avatar_url: null },
        ],
        error: null,
      });

      const social = await service.getSocial(ME, W);

      expect(social.likeCount).toBe(1);
      expect(social.likedByMe).toBe(true);
      expect(social.comments.map((c) => [c.id, c.canDelete])).toEqual([
        ['c1', true],
        ['c2', false],
      ]);
    });
  });

  describe('summarize', () => {
    it('counts likes and comments on the workouts you can see', async () => {
      const { client, service } = setup();
      client.queue('workouts', {
        data: [workout(), workout({ id: 'hidden', user_id: 'stranger' })],
        error: null,
      });
      client.queue('follows', { data: [{ followee_id: SAM }], error: null });
      client.queue('user_blocks', { data: [], error: null });
      client.queue('workout_likes', {
        data: [
          { workout_id: W, user_id: ME },
          { workout_id: W, user_id: SAM },
        ],
        error: null,
      });
      client.queue('workout_comments', { data: [{ workout_id: W, user_id: SAM }], error: null });

      const summary = await service.summarize(ME, [W, 'hidden']);

      expect(summary).toEqual({ [W]: { likeCount: 2, commentCount: 1, likedByMe: true } });
    });
  });
});
