import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { FeedService } from '../feed/feed.service';
import { FollowsService } from '../follows/follows.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { PeopleService } from './people.service';

interface QueuedResult {
  data: unknown;
  error: { code?: string; message: string } | null;
  count?: number | null;
}

const CHAIN = ['select', 'eq', 'in', 'is', 'not', 'or', 'gte', 'order', 'limit', 'range'] as const;

/** Per-table FIFO results, as in the other specs, plus counts and rpc calls. */
function createMockClient() {
  const queues = new Map<string, QueuedResult[]>();
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const queue = (key: string, result: QueuedResult) => {
    queues.set(key, [...(queues.get(key) ?? []), result]);
  };
  const next = (key: string): QueuedResult => {
    const result = queues.get(key)?.shift();
    if (!result) throw new Error(`No queued result for "${key}"`);
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
    b.then = (ok: (r: QueuedResult) => unknown, fail?: (e: unknown) => unknown) =>
      Promise.resolve(next(table)).then(ok, fail);
    return b;
  };
  const from = jest.fn((table: string) => builder(table));
  const rpc = jest.fn(async (name: string, args: unknown) => {
    calls.push({ table: `rpc:${name}`, method: 'rpc', args: [args] });
    return next(`rpc:${name}`);
  });
  return { from, rpc, queue, calls };
}

const ME = '11111111-1111-1111-1111-111111111111';
const SAM = '22222222-2222-2222-2222-222222222222';
const JO = '33333333-3333-3333-3333-333333333333';

const user = (id: string, name: string) => ({
  id,
  username: name.toLowerCase(),
  display_name: name,
  avatar_url: null,
});

function serviceWith(client: ReturnType<typeof createMockClient>, feed: Partial<FeedService> = {}) {
  const supabaseService = { getClient: () => client } as unknown as SupabaseService;
  return new PeopleService(
    supabaseService,
    new FollowsService(supabaseService),
    feed as FeedService,
  );
}

/** How ME stands with SAM: blocks, then follows either way. */
function queueRelationship(
  client: ReturnType<typeof createMockClient>,
  follows: { id: string; follower_id: string; followee_id: string; status: string }[],
  blocks: { blocker_id: string; blocked_id: string }[] = [],
) {
  client.queue('user_blocks', { data: blocks, error: null });
  client.queue('follows', { data: follows, error: null });
}

describe('PeopleService', () => {
  describe('getProfile', () => {
    it('shows someone you follow in full: counts, workout stats and heaviest lifts', async () => {
      const client = createMockClient();
      queueRelationship(client, [
        { id: 'f1', follower_id: ME, followee_id: SAM, status: 'accepted' },
        { id: 'f2', follower_id: SAM, followee_id: ME, status: 'pending' },
      ]);
      client.queue('users', { data: [user(SAM, 'Sam')], error: null });
      // Who you follow comes first (for mutual friends), then the two counts.
      client.queue('follows', {
        data: [{ followee_id: SAM }, { followee_id: JO }, { followee_id: 'blocked-id' }],
        error: null,
      });
      client.queue('follows', { data: null, error: null, count: 12 });
      client.queue('follows', { data: null, error: null, count: 3 });
      client.queue('users', {
        data: { bio: 'Building strength.' },
        error: null,
      });
      client.queue('follows', {
        data: [{ follower_id: JO }, { follower_id: 'blocked-id' }],
        error: null,
      });
      client.queue('user_blocks', {
        data: [{ blocker_id: 'blocked-id', blocked_id: ME }],
        error: null,
      });
      client.queue('users', { data: [user(JO, 'Jo')], error: null });
      client.queue('workouts', { data: null, error: null, count: 40 });
      client.queue('workouts', { data: null, error: null, count: 9 });
      client.queue('rpc:person_profile_totals', {
        data: [{ total_volume_kg: '19400.50', pr_count: 24, best_month_workouts: 14 }],
        error: null,
      });
      client.queue('rpc:person_best_lifts', {
        data: [{ exercise_id: 'ex-row', weight_kg: '100.00', reps: 5, performed_at: '2026-11-01' }],
        error: null,
      });
      client.queue('exercises', {
        data: [
          {
            id: 'ex-row',
            name: 'Seated Row',
            photo_url: 'https://example.com/row.jpg',
            gym: 'Downtown',
            attachment: 'V-handle',
          },
        ],
        error: null,
      });
      const service = serviceWith(client);

      const profile = await service.getProfile(ME, SAM);

      expect(profile).toEqual({
        user: { id: SAM, username: 'sam', displayName: 'Sam', avatarUrl: null },
        isSelf: false,
        followStatus: 'accepted',
        followsYou: false,
        requestId: 'f2',
        followerCount: 12,
        followingCount: 3,
        bio: 'Building strength.',
        // Jo: followed by you, following Sam -- never Sam, never anyone blocked.
        mutuals: {
          count: 1,
          people: [{ id: JO, username: 'jo', displayName: 'Jo', avatarUrl: null }],
        },
        canSeeActivity: true,
        stats: {
          workouts: 40,
          lastThirtyDays: 9,
          totalVolumeKg: 19400.5,
          prCount: 24,
          bestMonthWorkouts: 14,
        },
        bestLifts: [
          {
            exerciseId: 'ex-row',
            exerciseName: 'Seated Row',
            photoUrl: 'https://example.com/row.jpg',
            gym: 'Downtown',
            attachment: 'V-handle',
            weightKg: 100,
            reps: 5,
            performedAt: '2026-11-01',
          },
        ],
      });
      // Followers see what their followers can: no trainer-logged workouts in the counts.
      expect(client.calls).toContainEqual({
        table: 'workouts',
        method: 'is',
        args: ['logged_by', null],
      });
      expect(client.rpc).toHaveBeenCalledWith('person_profile_totals', {
        p_owner: SAM,
        p_include_trainer_logged: false,
      });
    });

    it('shows only who someone is, and their counts, until they accept your follow', async () => {
      const client = createMockClient();
      queueRelationship(client, [
        { id: 'f1', follower_id: ME, followee_id: SAM, status: 'pending' },
      ]);
      client.queue('users', { data: [user(SAM, 'Sam')], error: null });
      client.queue('follows', { data: [], error: null });
      client.queue('follows', { data: null, error: null, count: 12 });
      client.queue('follows', { data: null, error: null, count: 3 });
      client.queue('users', { data: { bio: null }, error: null });
      const service = serviceWith(client);

      const profile = await service.getProfile(ME, SAM);

      // Who they are -- bio and goals too -- but nothing of their training.
      expect(profile).toMatchObject({
        followStatus: 'pending',
        bio: null,
        mutuals: { count: 0, people: [] },
        canSeeActivity: false,
        stats: null,
        bestLifts: null,
      });
      expect(client.rpc).not.toHaveBeenCalled();
      expect(client.from).not.toHaveBeenCalledWith('workouts');
    });

    it("counts a trainer's logging on your own profile, with no mutual friends", async () => {
      const client = createMockClient();
      client.queue('users', { data: [user(ME, 'Me')], error: null });
      client.queue('follows', { data: null, error: null, count: 2 });
      client.queue('follows', { data: null, error: null, count: 5 });
      client.queue('users', { data: { bio: null }, error: null });
      client.queue('workouts', { data: null, error: null, count: 3 });
      client.queue('workouts', { data: null, error: null, count: 1 });
      client.queue('rpc:person_profile_totals', { data: [], error: null });
      client.queue('rpc:person_best_lifts', { data: [], error: null });
      const service = serviceWith(client);

      const profile = await service.getProfile(ME, ME);

      expect(profile).toMatchObject({
        isSelf: true,
        mutuals: { count: 0, people: [] },
        stats: { workouts: 3, totalVolumeKg: 0, prCount: 0, bestMonthWorkouts: 0 },
      });
      expect(client.rpc).toHaveBeenCalledWith('person_profile_totals', {
        p_owner: ME,
        p_include_trainer_logged: true,
      });
    });

    it('is not found for someone blocked either way', async () => {
      const client = createMockClient();
      queueRelationship(client, [], [{ blocker_id: SAM, blocked_id: ME }]);
      const service = serviceWith(client);

      await expect(service.getProfile(ME, SAM)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getWorkouts', () => {
    it("pages someone you follow's workouts, leaving out a trainer's logging", async () => {
      const client = createMockClient();
      queueRelationship(client, [
        { id: 'f1', follower_id: ME, followee_id: SAM, status: 'accepted' },
      ]);
      const getPersonWorkouts = jest.fn().mockResolvedValue({ items: [], hasMore: false });
      const service = serviceWith(client, { getPersonWorkouts });

      await service.getWorkouts(ME, SAM, 2);

      expect(getPersonWorkouts).toHaveBeenCalledWith(SAM, 2, { includeTrainerLogged: false });
    });

    it("refuses someone you don't follow", async () => {
      const client = createMockClient();
      queueRelationship(client, []);
      const service = serviceWith(client);

      await expect(service.getWorkouts(ME, SAM, 0)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('listFollowers', () => {
    it('lists who follows them, with your own follow of each -- nobody blocked', async () => {
      const client = createMockClient();
      queueRelationship(client, [
        { id: 'f1', follower_id: ME, followee_id: SAM, status: 'accepted' },
      ]);
      client.queue('follows', {
        data: [{ follower_id: JO }, { follower_id: ME }, { follower_id: 'blocked-id' }],
        error: null,
      });
      client.queue('user_blocks', {
        data: [{ blocker_id: ME, blocked_id: 'blocked-id' }],
        error: null,
      });
      client.queue('users', { data: [user(JO, 'Jo'), user(ME, 'Me')], error: null });
      client.queue('follows', { data: [{ followee_id: JO, status: 'pending' }], error: null });
      const service = serviceWith(client);

      const followers = await service.listFollowers(ME, SAM);

      expect(followers).toEqual([
        { user: expect.objectContaining({ id: JO }), status: 'pending' },
        { user: expect.objectContaining({ id: ME }), status: 'none' },
      ]);
    });
  });

  describe('matchContacts', () => {
    it('matches hashed contact emails, never returning yourself', async () => {
      const client = createMockClient();
      const hash = 'A'.repeat(64);
      client.queue('rpc:find_users_by_email_hashes', {
        data: [{ user_id: SAM }, { user_id: ME }],
        error: null,
      });
      client.queue('user_blocks', { data: [], error: null });
      client.queue('users', { data: [user(SAM, 'Sam')], error: null });
      client.queue('follows', { data: [], error: null });
      const service = serviceWith(client);

      const found = await service.matchContacts(ME, [hash, hash.toLowerCase()]);

      expect(found).toEqual([{ user: expect.objectContaining({ id: SAM }), status: 'none' }]);
      // Lower-cased and each once.
      expect(client.rpc).toHaveBeenCalledWith('find_users_by_email_hashes', {
        p_hashes: ['a'.repeat(64)],
      });
    });
  });
});
