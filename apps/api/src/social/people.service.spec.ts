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
    it('shows someone you follow in full: counts, workout figures and every exercise', async () => {
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
        data: { last_name: 'Lee', bio: 'Building strength.' },
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
        data: [
          {
            total_volume_kg: '19400.50',
            pr_count: 24,
            best_month_workouts: 14,
            total_sets: 900,
            total_reps: 7200,
            training_minutes: 2400,
            one_rep_max_count: 3,
            exercise_count: 18,
            best_session_volume_kg: '9100.00',
            bodyweight_reps: 640,
            timed_seconds: 1800,
            group_workouts: 4,
            committed_months: 2,
            strong_weeks: 11,
            likes_received: 31,
            likes_given: 27,
          },
        ],
        error: null,
      });
      client.queue('rpc:person_exercise_bests', {
        data: [
          {
            exercise_id: 'ex-row',
            measurement_type: 'weight_reps',
            weight_kg: '100.00',
            reps: 5,
            duration_seconds: null,
            performed_at: '2026-11-01',
            workouts: 12,
            last_performed_at: '2026-11-10',
          },
          {
            exercise_id: 'ex-plank',
            measurement_type: 'timed',
            weight_kg: null,
            reps: null,
            duration_seconds: 95,
            performed_at: '2026-11-02',
            workouts: 3,
            last_performed_at: '2026-11-02',
          },
        ],
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
          { id: 'ex-plank', name: 'Plank', photo_url: null, gym: null, attachment: null },
        ],
        error: null,
      });
      client.queue('achievement_definitions', {
        data: [
          {
            id: 'first-steps',
            title: 'First Steps',
            description: 'Finish your first workout',
            icon: 'play',
            category: 'workouts',
            kind: 'single',
          },
          {
            id: 'guns-blazin',
            title: "Guns Blazin'",
            description: 'Lift weight on biceps exercises',
            icon: 'zap',
            category: 'muscles',
            kind: 'levels',
          },
        ],
        error: null,
      });
      client.queue('achievement_levels', {
        data: [
          { achievement_id: 'first-steps', level: 1 },
          ...Array.from({ length: 8 }, (_, i) => ({ achievement_id: 'guns-blazin', level: i + 1 })),
          { achievement_id: 'fuel-logger', level: 1 },
        ],
        error: null,
      });
      client.queue('achievement_awards', {
        data: [
          { achievement_id: 'first-steps', level: 1, ap: 25, awarded_at: '2026-01-02T10:00:00Z' },
          { achievement_id: 'fuel-logger', level: 1, ap: 50, awarded_at: '2026-01-03T10:00:00Z' },
          { achievement_id: 'guns-blazin', level: 1, ap: 20, awarded_at: '2026-01-04T10:00:00Z' },
          { achievement_id: 'guns-blazin', level: 2, ap: 40, awarded_at: '2026-01-11T10:00:00Z' },
        ],
        error: null,
      });
      client.queue('rpc:award_achievements', { data: [], error: null });
      client.queue('rpc:achievement_summary', {
        data: [{ points: 1250, awards: 14 }],
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
        // Their last name, after their first.
        lastName: 'Lee',
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
          totalSets: 900,
          totalReps: 7200,
          trainingMinutes: 2400,
          oneRepMaxCount: 3,
          exerciseCount: 18,
          bestSessionVolumeKg: 9100,
          bodyweightReps: 640,
          timedSeconds: 1800,
          groupWorkouts: 4,
          committedMonths: 2,
          strongWeeks: 11,
          likesReceived: 31,
          likesGiven: 27,
        },
        // App versions before every exercise: the heaviest weighted lifts alone.
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
        exercises: [
          {
            exerciseId: 'ex-row',
            exerciseName: 'Seated Row',
            photoUrl: 'https://example.com/row.jpg',
            gym: 'Downtown',
            attachment: 'V-handle',
            measurementType: 'weight_reps',
            weightKg: 100,
            reps: 5,
            durationSeconds: null,
            performedAt: '2026-11-01',
            workouts: 12,
            lastPerformedAt: '2026-11-10',
          },
          {
            exerciseId: 'ex-plank',
            exerciseName: 'Plank',
            photoUrl: null,
            gym: null,
            attachment: null,
            measurementType: 'timed',
            weightKg: null,
            reps: null,
            durationSeconds: 95,
            performedAt: '2026-11-02',
            workouts: 3,
            lastPerformedAt: '2026-11-02',
          },
        ],
        rank: { points: 1250, awards: 14 },
        // The latest first, each at the level reached with the AP its levels brought -- never a
        // nutrition one.
        achievements: [
          {
            id: 'guns-blazin',
            title: "Guns Blazin'",
            description: 'Lift weight on biceps exercises',
            icon: 'zap',
            category: 'muscles',
            kind: 'levels',
            level: 2,
            levels: 8,
            ap: 60,
            firstAwardedAt: '2026-01-04T10:00:00Z',
            lastAwardedAt: '2026-01-11T10:00:00Z',
          },
          {
            id: 'first-steps',
            title: 'First Steps',
            description: 'Finish your first workout',
            icon: 'play',
            category: 'workouts',
            kind: 'single',
            level: 1,
            levels: 1,
            ap: 25,
            firstAwardedAt: '2026-01-02T10:00:00Z',
            lastAwardedAt: '2026-01-02T10:00:00Z',
          },
        ],
      });
      expect(client.calls).toContainEqual({
        table: 'achievement_definitions',
        method: 'eq',
        args: ['visibility', 'public'],
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
      expect(client.rpc).toHaveBeenCalledWith('person_exercise_bests', {
        p_owner: SAM,
        p_include_trainer_logged: false,
      });
      // Their achievements as of now, before they're read.
      expect(client.rpc).toHaveBeenCalledWith('award_achievements', { p_user: SAM, p_zone: 'UTC' });
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
      client.queue('rpc:award_achievements', { data: [], error: null });
      client.queue('rpc:achievement_summary', { data: [{ points: 640, awards: 9 }], error: null });
      const service = serviceWith(client);

      const profile = await service.getProfile(ME, SAM);

      // Who they are and their rank -- but nothing of their training.
      expect(profile).toMatchObject({
        followStatus: 'pending',
        bio: null,
        mutuals: { count: 0, people: [] },
        canSeeActivity: false,
        stats: null,
        bestLifts: null,
        exercises: null,
        rank: { points: 640, awards: 9 },
        achievements: null,
      });
      // Brought up to date for their rank, which anyone may see.
      expect(client.rpc).toHaveBeenCalledWith(
        'award_achievements',
        expect.objectContaining({ p_user: SAM }),
      );
      expect(client.from).not.toHaveBeenCalledWith('workouts');
      expect(client.from).not.toHaveBeenCalledWith('achievement_awards');
    });

    it('still shows the profile when bringing their achievements up to date fails', async () => {
      const client = createMockClient();
      queueRelationship(client, [
        { id: 'f1', follower_id: ME, followee_id: SAM, status: 'pending' },
      ]);
      client.queue('users', { data: [user(SAM, 'Sam')], error: null });
      client.queue('follows', { data: [], error: null });
      client.queue('follows', { data: null, error: null, count: 12 });
      client.queue('follows', { data: null, error: null, count: 3 });
      client.queue('users', { data: { bio: null }, error: null });
      // Nothing queued for award_achievements: it fails.
      client.queue('rpc:achievement_summary', { data: [{ points: 640, awards: 9 }], error: null });
      const service = serviceWith(client);

      await expect(service.getProfile(ME, SAM)).resolves.toMatchObject({
        rank: { points: 640, awards: 9 },
      });
    });

    it('hides the rank of someone who chose to hide it', async () => {
      const client = createMockClient();
      queueRelationship(client, [
        { id: 'f1', follower_id: ME, followee_id: SAM, status: 'pending' },
      ]);
      client.queue('users', { data: [user(SAM, 'Sam')], error: null });
      client.queue('follows', { data: [], error: null });
      client.queue('follows', { data: null, error: null, count: 12 });
      client.queue('follows', { data: null, error: null, count: 3 });
      client.queue('users', { data: { bio: null, show_rank: false }, error: null });
      const service = serviceWith(client);

      const profile = await service.getProfile(ME, SAM);

      expect(profile.rank).toBeNull();
      expect(client.rpc).not.toHaveBeenCalled();
    });

    it("counts a trainer's logging on your own profile, with no mutual friends", async () => {
      const client = createMockClient();
      client.queue('users', { data: [user(ME, 'Me')], error: null });
      client.queue('follows', { data: null, error: null, count: 2 });
      client.queue('follows', { data: null, error: null, count: 5 });
      client.queue('users', {
        data: { bio: null, show_rank: false, time_zone: 'America/Toronto' },
        error: null,
      });
      client.queue('rpc:award_achievements', { data: [], error: null });
      client.queue('workouts', { data: null, error: null, count: 3 });
      client.queue('workouts', { data: null, error: null, count: 1 });
      client.queue('rpc:person_profile_totals', { data: [], error: null });
      client.queue('rpc:person_exercise_bests', { data: [], error: null });
      client.queue('achievement_definitions', { data: [], error: null });
      client.queue('achievement_levels', { data: [], error: null });
      client.queue('achievement_awards', { data: [], error: null });
      client.queue('rpc:achievement_summary', { data: [{ points: 75, awards: 2 }], error: null });
      const service = serviceWith(client);

      const profile = await service.getProfile(ME, ME);

      expect(profile).toMatchObject({
        isSelf: true,
        mutuals: { count: 0, people: [] },
        stats: { workouts: 3, totalVolumeKg: 0, prCount: 0, bestMonthWorkouts: 0, totalSets: 0 },
        exercises: [],
        // Your own rank shows to you, even hidden from others.
        rank: { points: 75, awards: 2 },
        achievements: [],
      });
      expect(client.rpc).toHaveBeenCalledWith('award_achievements', {
        p_user: ME,
        p_zone: 'America/Toronto',
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

  describe('getExercise', () => {
    const EX = '44444444-4444-4444-4444-444444444444';
    const following = [{ id: 'f1', follower_id: ME, followee_id: SAM, status: 'accepted' }];

    it("shows a friend's top set from each workout and every record they hold on it", async () => {
      const client = createMockClient();
      queueRelationship(client, following);
      client.queue('rpc:person_exercise_history', {
        data: [
          {
            workout_id: 'w2',
            performed_at: '2026-11-10',
            measurement_type: 'weight_reps',
            weight_kg: '110.00',
            reps: 3,
            duration_seconds: null,
          },
          {
            workout_id: 'w1',
            performed_at: '2026-11-03',
            measurement_type: 'weight_reps',
            weight_kg: '100.00',
            reps: 5,
            duration_seconds: null,
          },
        ],
        error: null,
      });
      client.queue('rpc:person_exercise_records', {
        data: [
          { kind: 'max', reps: 1, weight_kg: '120.00', duration_seconds: null, achieved_at: 'a1' },
          { kind: 'rep', reps: 5, weight_kg: '100.00', duration_seconds: null, achieved_at: 'a5' },
          { kind: 'rep', reps: 3, weight_kg: '110.00', duration_seconds: null, achieved_at: 'a3' },
        ],
        error: null,
      });
      client.queue('exercises', {
        data: [{ id: EX, name: 'Bench Press', photo_url: null, gym: 'Downtown', attachment: null }],
        error: null,
      });
      const service = serviceWith(client);

      const exercise = await service.getExercise(ME, SAM, EX);

      expect(exercise).toEqual({
        exercise: {
          exerciseId: EX,
          exerciseName: 'Bench Press',
          photoUrl: null,
          gym: 'Downtown',
          attachment: null,
          measurementType: 'weight_reps',
        },
        topSets: [
          {
            workoutId: 'w2',
            performedAt: '2026-11-10',
            weightKg: 110,
            reps: 3,
            durationSeconds: null,
          },
          {
            workoutId: 'w1',
            performedAt: '2026-11-03',
            weightKg: 100,
            reps: 5,
            durationSeconds: null,
          },
        ],
        repPRs: [
          { reps: 3, weightKg: 110, achievedAt: 'a3' },
          { reps: 5, weightKg: 100, achievedAt: 'a5' },
        ],
        oneRepMax: { weightKg: 120, achievedAt: 'a1' },
        mostReps: null,
        longest: null,
      });
      // Only the workouts their followers can see.
      expect(client.rpc).toHaveBeenCalledWith('person_exercise_history', {
        p_owner: SAM,
        p_exercise: EX,
        p_include_trainer_logged: false,
        p_limit: 100,
      });
    });

    it("counts a trainer's logging on your own, with a bodyweight exercise's most reps", async () => {
      const client = createMockClient();
      client.queue('rpc:person_exercise_history', {
        data: [
          {
            workout_id: 'w1',
            performed_at: '2026-11-10',
            measurement_type: 'bodyweight',
            weight_kg: null,
            reps: 25,
            duration_seconds: null,
          },
        ],
        error: null,
      });
      client.queue('rpc:person_exercise_records', {
        data: [
          {
            kind: 'most_reps',
            reps: 25,
            weight_kg: null,
            duration_seconds: null,
            achieved_at: 'b',
          },
        ],
        error: null,
      });
      client.queue('exercises', {
        data: [{ id: EX, name: 'Push-Up', photo_url: null, gym: null, attachment: null }],
        error: null,
      });
      const service = serviceWith(client);

      const exercise = await service.getExercise(ME, ME, EX);

      expect(exercise).toMatchObject({
        exercise: { measurementType: 'bodyweight' },
        repPRs: [],
        oneRepMax: null,
        mostReps: { reps: 25, achievedAt: 'b' },
      });
      expect(client.rpc).toHaveBeenCalledWith(
        'person_exercise_records',
        expect.objectContaining({ p_include_trainer_logged: true }),
      );
    });

    it("refuses someone you don't follow", async () => {
      const client = createMockClient();
      queueRelationship(client, [
        { id: 'f1', follower_id: ME, followee_id: SAM, status: 'pending' },
      ]);
      const service = serviceWith(client);

      await expect(service.getExercise(ME, SAM, EX)).rejects.toBeInstanceOf(ForbiddenException);
      expect(client.rpc).not.toHaveBeenCalled();
    });

    it("is not found for an exercise they haven't done", async () => {
      const client = createMockClient();
      queueRelationship(client, following);
      client.queue('rpc:person_exercise_history', { data: [], error: null });
      client.queue('rpc:person_exercise_records', { data: [], error: null });
      const service = serviceWith(client);

      await expect(service.getExercise(ME, SAM, EX)).rejects.toBeInstanceOf(NotFoundException);
      expect(client.from).not.toHaveBeenCalledWith('exercises');
    });

    it('is not found for someone blocked either way', async () => {
      const client = createMockClient();
      queueRelationship(client, [], [{ blocker_id: SAM, blocked_id: ME }]);
      const service = serviceWith(client);

      await expect(service.getExercise(ME, SAM, EX)).rejects.toBeInstanceOf(NotFoundException);
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
