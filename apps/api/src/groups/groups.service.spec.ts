import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import type { SocialPushService } from '../notifications/social-push.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { GroupsService } from './groups.service';

interface Result {
  data: unknown;
  error: { message: string } | null;
}

const CHAIN = [
  'select',
  'eq',
  'not',
  'in',
  'gt',
  'or',
  'order',
  'limit',
  'insert',
  'update',
  'delete',
  'is',
] as const;

/** Queues results per table, consumed in the order the service asks. Calls are recorded. */
function createMockClient() {
  const queues = new Map<string, Result[]>();
  const createQueue: Result[] = [];
  const calls: { target: string; method: string; args: unknown[] }[] = [];

  const take = (queue: Result[] | undefined, name: string): Promise<Result> => {
    const next = queue?.shift();
    // No blocks unless a test queues some.
    if (!next && name === 'user_blocks') return Promise.resolve({ data: [], error: null });
    if (!next) return Promise.reject(new Error(`No queued result for "${name}"`));
    return Promise.resolve(next);
  };

  function builderFor(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {};
    for (const method of CHAIN) {
      builder[method] = jest.fn((...args: unknown[]) => {
        calls.push({ target: table, method, args });
        return builder;
      });
    }
    builder.maybeSingle = jest.fn(() => take(queues.get(table), table));
    builder.single = jest.fn(() => take(queues.get(table), table));
    builder.then = (ok: (r: Result) => unknown, err?: (e: unknown) => unknown) =>
      take(queues.get(table), table).then(ok, err);
    return builder;
  }

  const client = {
    from: jest.fn((table: string) => builderFor(table)),
    auth: {
      admin: {
        createUser: jest.fn((attributes: unknown) => {
          calls.push({ target: 'auth.admin', method: 'createUser', args: [attributes] });
          return take(createQueue, 'auth.admin.createUser');
        }),
      },
    },
  };

  return {
    client,
    calls,
    queue(table: string, ...results: Result[]) {
      queues.set(table, [...(queues.get(table) ?? []), ...results]);
    },
    queueCreate(...results: Result[]) {
      createQueue.push(...results);
    },
  };
}

const ok = (data: unknown = null): Result => ({ data, error: null });

const HOST = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const TARGET = '33333333-3333-4333-8333-333333333333';
const GUEST = '44444444-4444-4444-8444-444444444444';
const GROUP = '55555555-5555-4555-8555-555555555555';

function setup() {
  const mock = createMockClient();
  const supabase = { getClient: () => mock.client } as unknown as SupabaseService;
  const push = {
    nameOf: jest.fn().mockResolvedValue('Sam'),
    notify: jest.fn().mockResolvedValue(undefined),
  };
  return {
    mock,
    push,
    service: new GroupsService(supabase, push as unknown as SocialPushService),
  };
}

/** Lets the pushes sent after an answer (never awaited by it) go out. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

const joined = (userId: string, role: 'host' | 'member' = 'member') =>
  ok({
    id: `m-${userId}`,
    user_id: userId,
    role,
    status: 'joined',
    is_guest: false,
  });

describe('GroupsService', () => {
  describe('create', () => {
    it('starts a group with the caller as host and gives them a workout in it', async () => {
      const { mock, service } = setup();
      mock.queue('workout_groups', ok({ id: GROUP }));
      mock.queue('workout_group_members', ok());
      mock.queue('workouts', ok());

      await expect(service.create(HOST, { name: 'Thursday legs' })).resolves.toEqual({
        groupId: GROUP,
        skipped: [],
      });

      const member = mock.calls.find(
        (c) => c.target === 'workout_group_members' && c.method === 'insert',
      );
      expect(member?.args[0]).toMatchObject({
        group_id: GROUP,
        user_id: HOST,
        role: 'host',
        status: 'joined',
      });
      const workout = mock.calls.find((c) => c.target === 'workouts' && c.method === 'insert');
      expect(workout?.args[0]).toMatchObject({
        user_id: HOST,
        group_id: GROUP,
        name: 'Thursday legs',
      });
    });

    it('adds the friends chosen when the group starts, and reports any it could not add', async () => {
      const { mock, service } = setup();
      mock.queue('workout_groups', ok({ id: GROUP }));
      mock.queue('workout_group_members', ok());
      mock.queue('workouts', ok());
      const invite = jest
        .spyOn(service, 'inviteMember')
        .mockResolvedValueOnce({ userId: 'a', status: 'invited' })
        .mockRejectedValueOnce(new ForbiddenException('not a friend'));

      await expect(
        service.create(HOST, { name: 'Legs', friendUsernames: ['sam_lifts', 'stranger'] }),
      ).resolves.toEqual({ groupId: GROUP, skipped: ['stranger'] });
      expect(invite).toHaveBeenCalledWith(HOST, GROUP, 'sam_lifts');
    });

    it('starts from an open workout of the caller’s own, rather than a new one', async () => {
      const { mock, service } = setup();
      mock.queue('workouts', ok(null));
      await expect(
        service.create(HOST, { name: 'Legs', workoutId: '66666666-6666-4666-8666-666666666666' }),
      ).rejects.toThrow(NotFoundException);
      expect(mock.calls.some((c) => c.target === 'workout_groups')).toBe(false);
    });
  });

  describe('inviteMember', () => {
    it('refuses someone who is neither a friend nor a client', async () => {
      const { mock, service } = setup();
      mock.queue('workout_groups', ok({ status: 'live' }));
      mock.queue('workout_group_members', joined(HOST, 'host'));
      mock.queue('users', ok({ id: TARGET }), ok({ id: TARGET }));
      mock.queue('follows', ok(null), ok(null));
      mock.queue('trainer_clients', ok(null), ok(null));

      await expect(service.inviteMember(HOST, GROUP, 'stranger_one')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('refuses a friend who blocked you, exactly as it refuses a stranger', async () => {
      const { mock, service } = setup();
      mock.queue('workout_groups', ok({ status: 'live' }));
      mock.queue('workout_group_members', joined(HOST, 'host'));
      mock.queue('users', ok({ id: TARGET }), ok({ id: TARGET }));
      mock.queue('user_blocks', ok([{ blocker_id: TARGET, blocked_id: HOST }]));

      await expect(service.inviteMember(HOST, GROUP, 'friend_one')).rejects.toThrow(
        'You can invite your friends and your clients',
      );
      expect(mock.calls.some((c) => c.method === 'insert')).toBe(false);
    });

    it('invites a friend, who then has to accept -- and tells them', async () => {
      const { mock, push, service } = setup();
      mock.queue('workout_groups', ok({ status: 'live' }), ok({ name: 'Thursday legs' }));
      mock.queue('workout_group_members', joined(HOST, 'host'), ok(null), ok());
      mock.queue('users', ok({ id: TARGET }), ok({ id: TARGET }));
      mock.queue('follows', ok({ id: 'f1' }), ok(null));
      mock.queue('trainer_clients', ok(null), ok(null));

      await expect(service.inviteMember(HOST, GROUP, 'friend_one')).resolves.toEqual({
        userId: TARGET,
        status: 'invited',
      });
      const invite = mock.calls.find(
        (c) => c.target === 'workout_group_members' && c.method === 'insert',
      );
      expect(invite?.args[0]).toMatchObject({
        user_id: TARGET,
        status: 'invited',
        role: 'member',
        added_by: HOST,
        invited_at: expect.any(String),
      });
      await settle();
      expect(push.notify).toHaveBeenCalledWith(TARGET, 'groupInvites', {
        title: 'Live workout invite',
        body: 'Sam wants to start a live workout with you: Thursday legs.',
        path: 'groups',
      });
    });

    it('refuses anyone who is not in the group', async () => {
      const { mock, service } = setup();
      mock.queue('users', ok({ id: TARGET }));
      mock.queue('workout_groups', ok({ status: 'live' }));
      mock.queue('workout_group_members', ok(null));
      await expect(service.inviteMember(HOST, GROUP, 'friend_one')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('addGuest', () => {
    it('adds a guest with a placeholder account and their own workout in the group', async () => {
      const { mock, service } = setup();
      mock.queue('workout_groups', ok({ status: 'live' }), ok({ name: 'Thursday legs' }));
      mock.queue('workout_group_members', joined(HOST, 'host'), ok());
      mock.queue('users', ok());
      mock.queue('workouts', ok());
      mock.queueCreate(ok({ user: { id: GUEST } }));

      await expect(service.addGuest(HOST, GROUP, { displayName: 'Pat' })).resolves.toEqual({
        userId: GUEST,
      });

      const account = mock.calls.find((c) => c.method === 'createUser');
      expect((account?.args[0] as { email: string }).email).toMatch(/@placeholders\.invalid$/);
      const member = mock.calls.find(
        (c) => c.target === 'workout_group_members' && c.method === 'insert',
      );
      expect(member?.args[0]).toMatchObject({ user_id: GUEST, is_guest: true, status: 'joined' });
      const workout = mock.calls.find((c) => c.target === 'workouts' && c.method === 'insert');
      expect(workout?.args[0]).toMatchObject({ user_id: GUEST, group_id: GROUP });
    });
  });

  describe('respondToInvite', () => {
    it('accepting joins the group and gives the caller their workout in it', async () => {
      const { mock, service } = setup();
      mock.queue(
        'workout_group_members',
        ok({ id: 'm2', user_id: MEMBER, role: 'member', status: 'invited', is_guest: false }),
        ok(),
      );
      mock.queue('workouts', ok(null), ok());
      mock.queue('workout_groups', ok({ status: 'live' }), ok({ name: 'Thursday legs' }));

      await service.respondToInvite(MEMBER, GROUP, 'accept');

      const update = mock.calls.find(
        (c) => c.target === 'workout_group_members' && c.method === 'update',
      );
      expect(update?.args[0]).toEqual({ status: 'joined', responded_at: expect.any(String) });
      const workout = mock.calls.find((c) => c.target === 'workouts' && c.method === 'insert');
      expect(workout?.args[0]).toMatchObject({ user_id: MEMBER, group_id: GROUP });
    });

    it('404s when there is no invite to answer', async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', ok(null));
      await expect(service.respondToInvite(MEMBER, GROUP, 'accept')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('invitations', () => {
    const invitedRow = (extra: Record<string, unknown> = {}) =>
      ok({
        id: 'm-target',
        user_id: TARGET,
        role: 'member',
        status: 'invited',
        is_guest: false,
        added_by: HOST,
        invited_at: '2026-11-25T10:00:00Z',
        ...extra,
      });

    it('never invites anyone twice, and invites someone again after they declined', async () => {
      const { mock, service } = setup();
      // Waiting already: as it is, nothing written.
      mock.queue('workout_groups', ok({ status: 'live' }), ok({ status: 'live' }));
      mock.queue('workout_group_members', joined(HOST, 'host'), joined(HOST, 'host'), invitedRow());
      mock.queue('users', ok({ id: TARGET }));
      mock.queue('follows', ok({ id: 'f1' }), ok(null));
      mock.queue('trainer_clients', ok(null), ok(null));
      await expect(service.inviteMany(HOST, GROUP, [TARGET])).resolves.toEqual([
        { userId: TARGET, status: 'invited' },
      ]);
      expect(mock.calls.some((c) => c.method === 'insert' || c.method === 'update')).toBe(false);

      // Declined before: a new invite, on the same row.
      mock.queue(
        'workout_groups',
        ok({ status: 'live' }),
        ok({ status: 'live' }),
        ok({ name: 'Legs' }),
      );
      mock.queue(
        'workout_group_members',
        joined(HOST, 'host'),
        joined(HOST, 'host'),
        invitedRow({ status: 'declined', responded_at: '2026-11-25T10:05:00Z' }),
        ok(),
      );
      mock.queue('users', ok({ id: TARGET }));
      mock.queue('follows', ok({ id: 'f1' }), ok(null));
      mock.queue('trainer_clients', ok(null), ok(null));
      await expect(service.inviteMany(HOST, GROUP, [TARGET])).resolves.toEqual([
        { userId: TARGET, status: 'invited' },
      ]);
      const again = mock.calls.find(
        (c) => c.target === 'workout_group_members' && c.method === 'update',
      );
      expect(again?.args[0]).toMatchObject({
        status: 'invited',
        added_by: HOST,
        invited_at: expect.any(String),
        responded_at: null,
      });
    });

    it('invites several at once, skipping anyone who can’t be invited', async () => {
      const { mock, service } = setup();
      const OTHER = '99999999-9999-9999-9999-999999999999';
      mock.queue(
        'workout_groups',
        ok({ status: 'live' }),
        ok({ status: 'live' }),
        ok({ status: 'live' }),
        ok({ name: 'Legs' }),
      );
      mock.queue(
        'workout_group_members',
        joined(HOST, 'host'),
        joined(HOST, 'host'),
        ok(null),
        ok(),
        joined(HOST, 'host'),
      );
      // A friend, then someone with no account.
      mock.queue('users', ok({ id: TARGET }), ok(null));
      mock.queue('follows', ok({ id: 'f1' }), ok(null));
      mock.queue('trainer_clients', ok(null), ok(null));

      await expect(service.inviteMany(HOST, GROUP, [TARGET, OTHER])).resolves.toEqual([
        { userId: TARGET, status: 'invited' },
        { userId: OTHER, status: 'skipped' },
      ]);
    });

    it('lets whoever sent an invite, or the host, cancel it while it waits', async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', joined(HOST, 'host'), invitedRow(), ok());
      mock.queue('workout_groups', ok({ host_id: HOST }));
      await service.cancelInvite(HOST, GROUP, TARGET);
      const cancelled = mock.calls.find(
        (c) => c.target === 'workout_group_members' && c.method === 'update',
      );
      expect(cancelled?.args[0]).toEqual({ status: 'cancelled', responded_at: expect.any(String) });

      // Someone else in the group, who didn't send it: no.
      mock.queue('workout_group_members', joined(MEMBER), invitedRow());
      mock.queue('workout_groups', ok({ host_id: HOST }));
      await expect(service.cancelInvite(MEMBER, GROUP, TARGET)).rejects.toThrow(ForbiddenException);

      // Answered already: nothing to cancel.
      mock.queue('workout_group_members', joined(HOST, 'host'), invitedRow({ status: 'joined' }));
      await expect(service.cancelInvite(HOST, GROUP, TARGET)).rejects.toThrow(NotFoundException);
    });

    it('declining says so -- not as if they joined and left -- and tells whoever sent it', async () => {
      const { mock, push, service } = setup();
      mock.queue('workout_group_members', invitedRow({ user_id: MEMBER }), ok());
      mock.queue('workout_groups', ok({ status: 'live' }), ok({ name: 'Thursday legs' }));

      await service.respondToInvite(MEMBER, GROUP, 'decline');
      await settle();

      const update = mock.calls.find(
        (c) => c.target === 'workout_group_members' && c.method === 'update',
      );
      expect(update?.args[0]).toEqual({ status: 'declined', responded_at: expect.any(String) });
      expect(push.notify).toHaveBeenCalledWith(HOST, 'groupInvites', {
        title: 'Invite declined',
        body: "Sam can't join your live workout: Thursday legs.",
        path: `groups/${GROUP}`,
      });
    });

    it('tells whoever sent it when it’s accepted', async () => {
      const { mock, push, service } = setup();
      mock.queue('workout_group_members', invitedRow({ user_id: MEMBER }), ok());
      mock.queue('workouts', ok({ id: 'w-member' }));
      mock.queue('workout_groups', ok({ status: 'live' }), ok({ name: 'Thursday legs' }));

      await service.respondToInvite(MEMBER, GROUP, 'accept');
      await settle();

      expect(push.notify).toHaveBeenCalledWith(HOST, 'groupInvites', {
        title: 'Invite accepted',
        body: 'Sam is joining your live workout: Thursday legs.',
        path: `groups/${GROUP}`,
      });
      // Already had a workout in the group: none made, nobody else touched.
      expect(mock.calls.filter((c) => c.method === 'insert')).toEqual([]);
      expect(mock.calls.filter((c) => c.method === 'update')).toHaveLength(1);
    });

    it("takes no answer once the workout has finished: it's expired", async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', invitedRow({ user_id: MEMBER }));
      mock.queue('workout_groups', ok({ status: 'finished' }));

      await expect(service.respondToInvite(MEMBER, GROUP, 'accept')).rejects.toThrow(GoneException);
      expect(mock.calls.some((c) => c.method === 'update')).toBe(false);
    });

    it('shows everyone in the group what became of each invite', async () => {
      const { mock, service } = setup();
      const [A, B, C, D] = ['aaaa', 'bbbb', 'cccc', 'dddd'];
      mock.queue(
        'workout_group_members',
        joined(MEMBER),
        ok([
          {
            id: 'm1',
            user_id: HOST,
            role: 'host',
            status: 'joined',
            is_guest: false,
            added_by: HOST,
            invited_at: null,
          },
          {
            id: 'm2',
            user_id: MEMBER,
            role: 'member',
            status: 'joined',
            is_guest: false,
            added_by: HOST,
            invited_at: '2026-11-25T10:00:00Z',
            responded_at: '2026-11-25T10:01:00Z',
          },
          {
            id: 'm3',
            user_id: A,
            role: 'member',
            status: 'invited',
            is_guest: false,
            added_by: MEMBER,
            invited_at: '2026-11-25T10:04:00Z',
          },
          {
            id: 'm4',
            user_id: B,
            role: 'member',
            status: 'invited',
            is_guest: false,
            added_by: HOST,
            invited_at: '2026-11-25T10:03:00Z',
          },
          {
            id: 'm5',
            user_id: C,
            role: 'member',
            status: 'declined',
            is_guest: false,
            added_by: HOST,
            invited_at: '2026-11-25T10:02:00Z',
            responded_at: '2026-11-25T10:06:00Z',
          },
          {
            id: 'm6',
            user_id: D,
            role: 'member',
            status: 'cancelled',
            is_guest: false,
            added_by: HOST,
            invited_at: '2026-11-25T10:00:30Z',
            responded_at: '2026-11-25T10:07:00Z',
          },
        ]),
      );
      mock.queue(
        'workout_groups',
        ok({
          id: GROUP,
          name: 'Thursday legs',
          status: 'live',
          host_id: HOST,
          started_at: '2026-11-25T09:55:00Z',
          finished_at: null,
        }),
      );
      mock.queue('workouts', ok([]));
      mock.queue('users', ok([]));

      const detail = await service.getDetail(MEMBER, GROUP);

      expect(detail.members.map((m) => [m.userId, m.status])).toEqual([
        [HOST, 'joined'],
        [MEMBER, 'joined'],
        [A, 'invited'],
        [B, 'invited'],
      ]);
      expect(
        detail.invitations.map((i) => [i.userId, i.status, i.invitedById, i.canCancel]),
      ).toEqual([
        // MEMBER sent A's: theirs to take back. B's is the host's.
        [A, 'pending', MEMBER, true],
        [B, 'pending', HOST, false],
        [C, 'declined', HOST, false],
        [D, 'cancelled', HOST, false],
        [MEMBER, 'accepted', HOST, false],
      ]);
    });
  });

  describe('getDetail', () => {
    it('shows the group only to someone who has joined it', async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', ok(null));
      await expect(service.getDetail(TARGET, GROUP)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('finish', () => {
    const done = { completed_at: '2026-11-21T10:00:00Z', deleted_at: null };
    const empty = { completed_at: null, deleted_at: null };

    it('completes every open workout in the group, for everyone', async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', joined(MEMBER));
      mock.queue('workout_groups', ok({ status: 'live' }), ok());
      mock.queue('workouts', ok([{ id: 'w-host' }, { id: 'w-member' }]), ok());
      mock.queue('workout_exercises', ok([{ id: 'we-1', sets: [done] }]));

      await service.finish(MEMBER, GROUP);

      const group = mock.calls.find((c) => c.target === 'workout_groups' && c.method === 'update');
      expect(group?.args[0]).toMatchObject({ status: 'finished' });
      const workouts = mock.calls.find((c) => c.target === 'workouts' && c.method === 'update');
      expect(workouts?.args[0]).toMatchObject({ completed_at: expect.any(String) });
      // Everything was done by someone: nothing is taken off.
      expect(
        mock.calls.some((c) => c.target === 'workout_exercises' && c.method === 'update'),
      ).toBe(false);
    });

    it("takes an exercise off the workout of anyone who did nothing on it, before it's completed", async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', joined(MEMBER));
      mock.queue('workout_groups', ok({ status: 'live' }), ok());
      mock.queue('workouts', ok([{ id: 'w-host' }, { id: 'w-member' }]), ok());
      mock.queue(
        'workout_exercises',
        ok([
          // Done: a finished set, even beside one left empty.
          { id: 'we-done', sets: [empty, done] },
          // Not done: no sets left (removed at Finish), only empty ones, or only removed ones.
          { id: 'we-none', sets: [] },
          { id: 'we-empty', sets: [empty] },
          { id: 'we-removed', sets: [{ ...done, deleted_at: '2026-11-21T10:05:00Z' }] },
        ]),
        ok(),
      );

      await service.finish(MEMBER, GROUP);

      const read = mock.calls.find((c) => c.target === 'workout_exercises' && c.method === 'in');
      expect(read?.args).toEqual(['workout_id', ['w-host', 'w-member']]);
      const drop = mock.calls.filter((c) => c.target === 'workout_exercises');
      const update = drop.find((c) => c.method === 'update');
      expect(update?.args[0]).toEqual({ deleted_at: expect.any(String) });
      expect(drop.at(-1)?.args).toEqual(['id', ['we-none', 'we-empty', 'we-removed']]);
      // Taken off first, then the group and its workouts are finished.
      const order = mock.calls.filter((c) => c.method === 'update').map((c) => c.target);
      expect(order).toEqual(['workout_exercises', 'workout_groups', 'workouts']);
    });

    it('finishes nothing if the exercises cannot be tidied, so it can be tried again', async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', joined(MEMBER));
      mock.queue('workout_groups', ok({ status: 'live' }));
      mock.queue('workouts', ok([{ id: 'w-member' }]));
      mock.queue('workout_exercises', { data: null, error: { message: 'boom' } });

      await expect(service.finish(MEMBER, GROUP)).rejects.toThrow(
        'Failed to load the group workouts',
      );
      expect(mock.calls.some((c) => c.method === 'update')).toBe(false);
    });
  });

  describe('leave', () => {
    it('a host cancel discards every open workout in the group and ends it, and completes none', async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', joined(HOST, 'host'));
      mock.queue('workout_groups', ok({ status: 'live' }));
      mock.queue('workouts', ok());
      mock.queue('workout_groups', ok());

      await service.cancel(HOST, GROUP);

      const discard = mock.calls.find((c) => c.target === 'workouts' && c.method === 'update');
      expect(discard?.args[0]).toEqual({ deleted_at: expect.any(String) });
      expect(
        mock.calls.some((c) => c.method === 'update' && 'completed_at' in (c.args[0] as object)),
      ).toBe(false);
      const end = mock.calls
        .filter((c) => c.target === 'workout_groups' && c.method === 'update')
        .at(-1);
      expect(end?.args[0]).toMatchObject({ status: 'finished' });
    });

    it('stops the host leaving, since the host finishes the group instead', async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', joined(HOST, 'host'));
      await expect(service.leave(HOST, GROUP)).rejects.toThrow(BadRequestException);
    });

    it('lets a member leave, and closes their own workout in the group', async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', joined(MEMBER), ok());
      mock.queue('workouts', ok());

      await service.leave(MEMBER, GROUP);

      const member = mock.calls.find(
        (c) => c.target === 'workout_group_members' && c.method === 'update',
      );
      expect(member?.args[0]).toEqual({ status: 'left' });
    });

    it('cancelling discards the workout rather than counting it, and leaves the group', async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', joined(MEMBER), ok());
      mock.queue('workout_groups', ok({ status: 'live' }));
      mock.queue('workouts', ok());
      mock.queue('workout_group_members', ok());

      await service.cancel(MEMBER, GROUP);

      const discard = mock.calls.find((c) => c.target === 'workouts' && c.method === 'update');
      expect(discard?.args[0]).toMatchObject({ deleted_at: expect.any(String) });
      expect(discard?.args[0]).not.toHaveProperty('completed_at');
      const left = mock.calls.filter(
        (c) => c.target === 'workout_group_members' && c.method === 'update',
      );
      expect(left.at(-1)?.args[0]).toEqual({ status: 'left' });
    });
  });
});

describe('GroupsService: a trainer adds their clients', () => {
  const CLIENT = '77777777-7777-4777-8777-777777777777';

  it('refuses someone who is not one of the caller’s active clients', async () => {
    const { mock, service } = setup();
    mock.queue('workout_groups', ok({ status: 'live' }));
    mock.queue('workout_group_members', joined(HOST, 'host'));
    mock.queue('subscriptions', ok({ id: 'sub' }));
    mock.queue('trainer_clients', ok(null));

    await expect(service.addClient(HOST, GROUP, CLIENT)).rejects.toThrow(ForbiddenException);
  });

  it('brings a tracked client straight into the group, with their workout', async () => {
    const { mock, service } = setup();
    mock.queue('workout_groups', ok({ status: 'live' }), ok({ name: 'Thursday legs' }));
    mock.queue('workout_group_members', joined(HOST, 'host'), ok(null), ok());
    mock.queue('subscriptions', ok({ id: 'sub' }));
    mock.queue('trainer_clients', ok({ id: 'l1' }));
    mock.queue('trainer_placeholder_clients', ok({ id: 'p1' }));
    mock.queue('workouts', ok());

    await expect(service.addClient(HOST, GROUP, CLIENT)).resolves.toEqual({
      userId: CLIENT,
      status: 'joined',
    });
    const member = mock.calls.find(
      (c) => c.target === 'workout_group_members' && c.method === 'insert',
    );
    expect(member?.args[0]).toMatchObject({ user_id: CLIENT, status: 'joined' });
    const workout = mock.calls.find((c) => c.target === 'workouts' && c.method === 'insert');
    expect(workout?.args[0]).toMatchObject({ user_id: CLIENT, group_id: GROUP });
  });

  it('invites a client who has their own account, and they accept', async () => {
    const { mock, service } = setup();
    mock.queue('workout_groups', ok({ status: 'live' }));
    mock.queue('workout_group_members', joined(HOST, 'host'), ok(null), ok());
    mock.queue('subscriptions', ok({ id: 'sub' }));
    mock.queue('trainer_clients', ok({ id: 'l1' }));
    mock.queue('trainer_placeholder_clients', ok(null));

    await expect(service.addClient(HOST, GROUP, CLIENT)).resolves.toEqual({
      userId: CLIENT,
      status: 'invited',
    });
    expect(mock.calls.some((c) => c.target === 'workouts' && c.method === 'insert')).toBe(false);
  });
});

describe('GroupsService: any day of your own split', () => {
  const SPLIT = '88888888-8888-4888-8888-888888888888';
  const DAY = '99999999-9999-4999-8999-999999999999';

  it('starts your group workout on a day of your own split, named after the day', async () => {
    const { mock, service } = setup();
    mock.queue('workout_split_days', ok({ name: 'Push', workout_split_id: SPLIT }));
    mock.queue('workout_splits', ok({ id: SPLIT }));
    mock.queue('workout_groups', ok({ id: GROUP }));
    mock.queue('workout_group_members', ok());
    mock.queue('workouts', ok());

    await service.create(HOST, { name: 'Thursday legs', splitDayId: DAY });

    const workout = mock.calls.find((c) => c.target === 'workouts' && c.method === 'insert');
    expect(workout?.args[0]).toMatchObject({
      user_id: HOST,
      name: 'Push',
      workout_split_day_id: DAY,
    });
  });

  it('refuses a day that is not in the caller’s own split', async () => {
    const { mock, service } = setup();
    mock.queue('workout_split_days', ok({ name: 'Push', workout_split_id: SPLIT }));
    mock.queue('workout_splits', ok(null));

    await expect(service.create(HOST, { name: 'Thursday legs', splitDayId: DAY })).rejects.toThrow(
      NotFoundException,
    );
    expect(mock.calls.some((c) => c.target === 'workout_groups')).toBe(false);
  });

  it('starts a workout outside the split, by the name given', async () => {
    const { mock, service } = setup();
    mock.queue('workout_groups', ok({ id: GROUP }));
    mock.queue('workout_group_members', ok());
    mock.queue('workouts', ok());

    await service.create(HOST, { name: 'Thursday legs', workoutName: 'Arms and abs' });

    const workout = mock.calls.find((c) => c.target === 'workouts' && c.method === 'insert');
    expect(workout?.args[0]).toMatchObject({ name: 'Arms and abs', workout_split_day_id: null });
  });

  it('changes your group workout to another day of your split, or clears it', async () => {
    const { mock, service } = setup();
    mock.queue('workout_group_members', joined(MEMBER));
    mock.queue('workout_split_days', ok({ name: 'Pull', workout_split_id: SPLIT }));
    mock.queue('workout_splits', ok({ id: SPLIT }));
    mock.queue('workouts', ok());
    await service.setMyWorkoutDay(MEMBER, GROUP, DAY);
    const change = mock.calls
      .filter((c) => c.target === 'workouts' && c.method === 'update')
      .at(-1);
    expect(change?.args[0]).toEqual({ workout_split_day_id: DAY });

    mock.queue('workout_group_members', joined(MEMBER));
    mock.queue('workouts', ok());
    await service.setMyWorkoutDay(MEMBER, GROUP, null);
    const cleared = mock.calls
      .filter((c) => c.target === 'workouts' && c.method === 'update')
      .at(-1);
    expect(cleared?.args[0]).toEqual({ workout_split_day_id: null });
  });
});
