import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { GroupsService } from './groups.service';

interface Result {
  data: unknown;
  error: { message: string } | null;
}

const CHAIN = [
  'select',
  'eq',
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
  return { mock, service: new GroupsService(supabase) };
}

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
      mock.queue('users', ok({ id: TARGET }));
      mock.queue('follows', ok(null), ok(null));
      mock.queue('trainer_clients', ok(null), ok(null));

      await expect(service.inviteMember(HOST, GROUP, 'stranger_one')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('invites a friend, who then has to accept', async () => {
      const { mock, service } = setup();
      mock.queue('workout_groups', ok({ status: 'live' }));
      mock.queue('workout_group_members', joined(HOST, 'host'), ok(null), ok());
      mock.queue('users', ok({ id: TARGET }));
      mock.queue('follows', ok({ id: 'f1' }), ok(null));
      mock.queue('trainer_clients', ok(null), ok(null));

      await expect(service.inviteMember(HOST, GROUP, 'friend_one')).resolves.toEqual({
        userId: TARGET,
        status: 'invited',
      });
      const invite = mock.calls.find(
        (c) => c.target === 'workout_group_members' && c.method === 'insert',
      );
      expect(invite?.args[0]).toMatchObject({ user_id: TARGET, status: 'invited', role: 'member' });
    });

    it('refuses anyone who is not in the group', async () => {
      const { mock, service } = setup();
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
      mock.queue('workout_groups', ok({ name: 'Thursday legs' }));

      await service.respondToInvite(MEMBER, GROUP, 'accept');

      const update = mock.calls.find(
        (c) => c.target === 'workout_group_members' && c.method === 'update',
      );
      expect(update?.args[0]).toEqual({ status: 'joined' });
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

  describe('getDetail', () => {
    it('shows the group only to someone who has joined it', async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', ok(null));
      await expect(service.getDetail(TARGET, GROUP)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('finish', () => {
    it('completes every open workout in the group, for everyone', async () => {
      const { mock, service } = setup();
      mock.queue('workout_group_members', joined(MEMBER));
      mock.queue('workout_groups', ok({ status: 'live' }), ok());
      mock.queue('workouts', ok());

      await service.finish(MEMBER, GROUP);

      const group = mock.calls.find((c) => c.target === 'workout_groups' && c.method === 'update');
      expect(group?.args[0]).toMatchObject({ status: 'finished' });
      const workouts = mock.calls.find((c) => c.target === 'workouts' && c.method === 'update');
      expect(workouts?.args[0]).toMatchObject({ completed_at: expect.any(String) });
    });
  });

  describe('leave', () => {
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
