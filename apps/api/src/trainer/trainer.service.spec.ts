import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import type { AddClientDto } from './dto/add-client.dto';
import type { LogWorkoutDto } from './dto/log-workout.dto';
import { TrainerService } from './trainer.service';

interface Result {
  data: unknown;
  error: { message: string } | null;
}

const CHAIN_METHODS = [
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

/**
 * Supabase stand-in for these tests. Results are queued per table (and per
 * rpc name, and per auth-admin call), and consumed in the order the service
 * issues queries. Every call is recorded so tests can assert what was written.
 */
function createMockClient() {
  const queues = new Map<string, Result[]>();
  const rpcQueues = new Map<string, Result[]>();
  const adminQueue: Result[] = [];
  const userQueue: Result[] = [];
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
    for (const method of CHAIN_METHODS) {
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
    rpc: jest.fn((name: string, args: unknown) => {
      calls.push({ target: `rpc:${name}`, method: 'rpc', args: [args] });
      return take(rpcQueues.get(name), `rpc:${name}`);
    }),
    auth: {
      admin: {
        inviteUserByEmail: jest.fn((email: string, options: unknown) => {
          calls.push({ target: 'auth.admin', method: 'inviteUserByEmail', args: [email, options] });
          return take(adminQueue, 'auth.admin.inviteUserByEmail');
        }),
        getUserById: jest.fn((id: string) => {
          calls.push({ target: 'auth.admin', method: 'getUserById', args: [id] });
          return take(userQueue, 'auth.admin.getUserById');
        }),
        createUser: jest.fn((attributes: unknown) => {
          calls.push({ target: 'auth.admin', method: 'createUser', args: [attributes] });
          return take(createQueue, 'auth.admin.createUser');
        }),
        deleteUser: jest.fn((id: string) => {
          calls.push({ target: 'auth.admin', method: 'deleteUser', args: [id] });
          return Promise.resolve({ data: null, error: null });
        }),
      },
    },
  };

  return {
    client,
    queue(table: string, ...results: Result[]) {
      queues.set(table, [...(queues.get(table) ?? []), ...results]);
    },
    queueRpc(name: string, ...results: Result[]) {
      rpcQueues.set(name, [...(rpcQueues.get(name) ?? []), ...results]);
    },
    queueInvite(...results: Result[]) {
      adminQueue.push(...results);
    },
    queueUser(...results: Result[]) {
      userQueue.push(...results);
    },
    queueCreate(...results: Result[]) {
      createQueue.push(...results);
    },
    calls,
  };
}

const ok = (data: unknown = null): Result => ({ data, error: null });
const fail = (message: string): Result => ({ data: null, error: { message } });

const TRAINER = '11111111-1111-4111-8111-111111111111';
const CLIENT = '22222222-2222-4222-8222-222222222222';
const NEW_CLIENT = '33333333-3333-4333-8333-333333333333';

function setup() {
  const mock = createMockClient();
  const supabase = { getClient: () => mock.client } as unknown as SupabaseService;
  return { mock, service: new TrainerService(supabase) };
}

/** A subscription row that makes the caller a Trainer. */
const activeTrainer = () => ok({ id: 'sub-1' });

const exerciseId = '44444444-4444-4444-8444-444444444444';
const logDto = (overrides: Partial<LogWorkoutDto> = {}): LogWorkoutDto =>
  ({
    name: 'Push day',
    performedAt: '2026-10-01T09:00:00.000Z',
    exercises: [
      {
        exerciseId,
        sets: [{ setIndex: 1, weightKg: 100, reps: 5 }],
      },
    ],
    ...overrides,
  }) as LogWorkoutDto;

const ALREADY_REGISTERED = 'A user with this email address has already been registered';

describe('TrainerService', () => {
  describe('getStatus', () => {
    it('reports the Trainer entitlement from the subscription projection', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      await expect(service.getStatus(TRAINER)).resolves.toEqual({ isTrainer: true });

      mock.queue('subscriptions', ok(null));
      await expect(service.getStatus(TRAINER)).resolves.toEqual({ isTrainer: false });
    });
  });

  describe('entitlement', () => {
    it('refuses every trainer action without an active Trainer entitlement', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', ok(null));
      await expect(service.addClient(TRAINER, { email: 'a@b.co' } as AddClientDto)).rejects.toThrow(
        ForbiddenException,
      );

      mock.queue('subscriptions', ok(null));
      await expect(service.logWorkout(TRAINER, CLIENT, logDto())).rejects.toThrow(
        ForbiddenException,
      );
      expect(mock.calls.some((c) => c.target === 'rpc:trainer_log_workout')).toBe(false);
    });
  });

  describe('addClient by username', () => {
    it('reports a username that matches no account, without creating anything', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('users', ok(null));
      await expect(
        service.addClient(TRAINER, { username: 'nobody_here' } as AddClientDto),
      ).rejects.toThrow(NotFoundException);
      expect(mock.calls.some((c) => c.method === 'insert')).toBe(false);
    });

    it('refuses to add yourself', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('users', ok({ id: TRAINER }));
      await expect(
        service.addClient(TRAINER, { username: 'me_coach' } as AddClientDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('sends the account a pending request, looking the username up in lower case', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('users', ok({ id: CLIENT }));
      mock.queue('trainer_clients', ok(null), ok({ id: 'link-1' }));
      mock.queue('trainer_actions', ok());

      const result = await service.addClient(TRAINER, { username: 'Sam_Lifts' } as AddClientDto);

      expect(result).toEqual({ kind: 'request', status: 'pending', clientId: CLIENT });
      const lookup = mock.calls.find((c) => c.target === 'users' && c.method === 'eq');
      expect(lookup?.args).toEqual(['username', 'sam_lifts']);
      expect(mock.client.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
    });

    it('re-requests an ended link as linked, so a trainer never keeps edit rights to an account the client owns', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('users', ok({ id: CLIENT }));
      mock.queue('trainer_clients', ok({ id: 'link-1', status: 'ended', source: 'managed' }), ok());
      mock.queue('trainer_actions', ok());

      const result = await service.addClient(TRAINER, { username: 'sam_lifts' } as AddClientDto);

      expect(result).toEqual({ kind: 'request', status: 'pending', clientId: CLIENT });
      const update = mock.calls.find(
        (c) => c.target === 'trainer_clients' && c.method === 'update',
      );
      expect(update?.args[0]).toMatchObject({ status: 'pending', source: 'linked' });
    });
  });

  describe('addClient by email (invite)', () => {
    it('invites a new email, records that the invite created the account, and answers the same way', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_invites', ok(null), ok({ id: 'inv-1' }), ok());
      mock.queue('trainer_actions', ok());
      mock.queueInvite({ data: { user: { id: NEW_CLIENT } }, error: null });

      const result = await service.addClient(TRAINER, {
        email: '  New@Example.com ',
        displayName: 'Sam',
        heightValue: 180,
        heightUnit: 'cm',
      } as AddClientDto);

      expect(result).toEqual({ kind: 'invite', status: 'invited' });
      const insert = mock.calls.find(
        (c) => c.target === 'trainer_invites' && c.method === 'insert',
      );
      expect(insert?.args[0]).toMatchObject({
        trainer_id: TRAINER,
        email: 'new@example.com',
        display_name: 'Sam',
        height_value: 180,
      });
      const invite = mock.calls.find((c) => c.method === 'inviteUserByEmail');
      expect(invite?.args[0]).toBe('new@example.com');
      const flag = mock.calls.filter(
        (c) => c.target === 'trainer_invites' && c.method === 'update',
      );
      expect(flag[0]?.args[0]).toEqual({ created_account: true });
    });

    it('answers exactly as it does for a new email when the address already has an account', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_invites', ok(null), ok({ id: 'inv-2' }), ok());
      mock.queue('trainer_actions', ok());
      mock.queueInvite({ data: null, error: { message: ALREADY_REGISTERED } });

      const result = await service.addClient(TRAINER, {
        email: 'existing@example.com',
      } as AddClientDto);

      expect(result).toEqual({ kind: 'invite', status: 'invited' });
      const flag = mock.calls.filter(
        (c) => c.target === 'trainer_invites' && c.method === 'update',
      );
      expect(flag[0]?.args[0]).toEqual({ created_account: false });
    });

    it('updates the existing pending invite rather than adding a second one', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_invites', ok({ id: 'inv-3' }), ok(), ok());
      mock.queueInvite({ data: null, error: { message: ALREADY_REGISTERED } });

      await service.addClient(TRAINER, {
        email: 'again@example.com',
        displayName: 'Ana',
      } as AddClientDto);

      expect(mock.calls.some((c) => c.target === 'trainer_invites' && c.method === 'insert')).toBe(
        false,
      );
      const update = mock.calls.find(
        (c) => c.target === 'trainer_invites' && c.method === 'update',
      );
      expect(update?.args[0]).toMatchObject({ display_name: 'Ana' });
    });

    it('fails honestly on a real invite error, rather than pretending it was sent', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_invites', ok(null), ok({ id: 'inv-4' }));
      mock.queue('trainer_actions', ok());
      mock.queueInvite({ data: null, error: { message: 'Email rate limit exceeded' } });

      await expect(
        service.addClient(TRAINER, { email: 'x@example.com' } as AddClientDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('needs exactly one of a username or an email', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      await expect(service.addClient(TRAINER, {} as AddClientDto)).rejects.toThrow(
        BadRequestException,
      );

      mock.queue('subscriptions', activeTrainer());
      await expect(
        service.addClient(TRAINER, { username: 'sam_lifts', email: 'a@b.co' } as AddClientDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('claimInvites', () => {
    const invite = {
      id: 'inv-9',
      trainer_id: TRAINER,
      email: 'new@example.com',
      display_name: 'Sam',
      birthday: null,
      height_value: 180,
      height_unit: 'cm',
      weight_value: null,
      weight_unit: 'kg',
      created_account: true,
    };

    it('claims nothing until the email is confirmed, so an invite cannot be taken by typing an address', async () => {
      const { mock, service } = setup();
      mock.queueUser(
        ok({ user: { id: NEW_CLIENT, email: 'new@example.com', email_confirmed_at: null } }),
      );

      await expect(service.claimInvites(NEW_CLIENT)).resolves.toEqual({ claimed: 0 });
      expect(mock.calls.some((c) => c.target === 'trainer_invites')).toBe(false);
    });

    it('attaches a confirmed invite as a managed link, fills only blank profile fields, and marks it claimed', async () => {
      const { mock, service } = setup();
      mock.queueUser(
        ok({
          user: { id: NEW_CLIENT, email: 'New@Example.com', email_confirmed_at: '2026-10-01' },
        }),
      );
      mock.queue('trainer_invites', ok([invite]), ok());
      mock.queue(
        'users',
        ok({ display_name: null, birthday: null, height_value: null, weight_value: 75 }),
        ok(),
      );
      mock.queue('trainer_clients', ok(null), ok({ id: 'link-9' }));
      mock.queue('trainer_actions', ok());

      await expect(service.claimInvites(NEW_CLIENT)).resolves.toEqual({ claimed: 1 });

      const profile = mock.calls.find((c) => c.target === 'users' && c.method === 'update');
      expect(profile?.args[0]).toEqual({
        display_name: 'Sam',
        height_value: 180,
        height_unit: 'cm',
      });
      const link = mock.calls.find((c) => c.target === 'trainer_clients' && c.method === 'insert');
      expect(link?.args[0]).toEqual({
        trainer_id: TRAINER,
        client_id: NEW_CLIENT,
        status: 'pending',
        source: 'managed',
      });
      const claim = mock.calls.filter(
        (c) => c.target === 'trainer_invites' && c.method === 'update',
      );
      expect(claim[0]?.args[0]).toMatchObject({ status: 'claimed', claimed_by: NEW_CLIENT });
    });

    it('links an existing account as linked, and does not duplicate a link that already exists', async () => {
      const { mock, service } = setup();
      mock.queueUser(
        ok({ user: { id: CLIENT, email: 'new@example.com', email_confirmed_at: '2026-10-01' } }),
      );
      mock.queue('trainer_invites', ok([{ ...invite, created_account: false }]), ok());
      mock.queue(
        'users',
        ok({ display_name: 'Already', birthday: null, height_value: 170, weight_value: null }),
      );
      mock.queue('trainer_clients', ok({ id: 'link-5', status: 'ended', source: 'linked' }));

      await expect(service.claimInvites(CLIENT)).resolves.toEqual({ claimed: 1 });
      expect(mock.calls.some((c) => c.target === 'trainer_clients' && c.method === 'insert')).toBe(
        false,
      );
      // Every field the invite offers is already set on this account (or not offered), so nothing is written.
      expect(mock.calls.some((c) => c.target === 'users' && c.method === 'update')).toBe(false);
    });
  });

  describe('listClients', () => {
    it('lists linked clients and, separately, invites still waiting for their person', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue(
        'trainer_clients',
        ok([{ client_id: CLIENT, status: 'active', source: 'managed' }]),
      );
      mock.queue('trainer_placeholder_clients', ok([]));
      mock.queue(
        'trainer_invites',
        ok([
          {
            id: 'inv-1',
            email: 'pat@example.com',
            display_name: 'Pat',
            birthday: null,
            height_value: null,
            height_unit: 'cm',
            weight_value: null,
            weight_unit: 'kg',
          },
        ]),
      );
      mock.queue(
        'users',
        ok([
          {
            id: CLIENT,
            display_name: 'Sam',
            birthday: null,
            height_value: null,
            height_unit: 'cm',
            weight_value: null,
            weight_unit: 'kg',
          },
        ]),
      );

      const clients = await service.listClients(TRAINER);

      expect(clients).toHaveLength(2);
      expect(clients[0]).toMatchObject({ clientId: CLIENT, status: 'active', displayName: 'Sam' });
      expect(clients[1]).toMatchObject({
        clientId: null,
        inviteId: 'inv-1',
        email: 'pat@example.com',
        status: 'invited',
        displayName: 'Pat',
      });
    });
  });

  describe('updateManagedProfile', () => {
    it('refuses to edit a linked account, which its owner controls', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_clients', ok({ id: 'l1', status: 'active', source: 'linked' }));
      await expect(
        service.updateManagedProfile(TRAINER, CLIENT, { weightValue: 90 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("edits a managed client's profile and records which fields changed", async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_clients', ok({ id: 'l1', status: 'active', source: 'managed' }));
      mock.queue('users', ok());
      mock.queue('trainer_actions', ok());

      await service.updateManagedProfile(TRAINER, CLIENT, { heightValue: 182 });

      const profile = mock.calls.find((c) => c.target === 'users' && c.method === 'update');
      expect(profile?.args[0]).toEqual({ height_value: 182 });
      const audit = mock.calls.find((c) => c.target === 'trainer_actions' && c.method === 'insert');
      expect(audit?.args[0]).toMatchObject({
        action: 'client.profile_updated',
        details: { fields: ['heightValue'] },
      });
    });
  });

  describe('logWorkout', () => {
    it('refuses a client whose link is not active', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_clients', ok({ id: 'l1', status: 'pending', source: 'linked' }));
      await expect(service.logWorkout(TRAINER, CLIENT, logDto())).rejects.toThrow(
        ForbiddenException,
      );
      expect(mock.calls.some((c) => c.target === 'rpc:trainer_log_workout')).toBe(false);
    });

    it('logs the workout atomically, defaulting each set side to none, and audits it', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_clients', ok({ id: 'l1', status: 'active', source: 'managed' }));
      mock.queueRpc('trainer_log_workout', ok('workout-1'));
      mock.queue('trainer_actions', ok());

      const result = await service.logWorkout(TRAINER, CLIENT, logDto());

      expect(result).toEqual({ workoutId: 'workout-1' });
      const rpc = mock.calls.find((c) => c.target === 'rpc:trainer_log_workout');
      expect(rpc?.args[0]).toMatchObject({
        p_trainer_id: TRAINER,
        p_client_id: CLIENT,
        p_payload: {
          name: 'Push day',
          exercises: [
            { exerciseId, sets: [{ setIndex: 1, side: 'none', weightKg: 100, reps: 5 }] },
          ],
        },
      });
      const audit = mock.calls.find((c) => c.target === 'trainer_actions' && c.method === 'insert');
      expect(audit?.args[0]).toMatchObject({ action: 'workout.logged', target_id: 'workout-1' });
    });

    it('turns a refused exercise into 403 and an unavailable one into 400', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_clients', ok({ id: 'l1', status: 'active', source: 'managed' }));
      mock.queueRpc(
        'trainer_log_workout',
        fail("exercise 55555555-5555-4555-8555-555555555555 is not in this trainer's library"),
      );
      await expect(service.logWorkout(TRAINER, CLIENT, logDto())).rejects.toThrow(
        ForbiddenException,
      );

      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_clients', ok({ id: 'l1', status: 'active', source: 'managed' }));
      mock.queueRpc('trainer_log_workout', fail('exercise x is not available'));
      await expect(service.logWorkout(TRAINER, CLIENT, logDto())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('hides unexpected database errors behind a generic 500', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_clients', ok({ id: 'l1', status: 'active', source: 'managed' }));
      mock.queueRpc('trainer_log_workout', fail('deadlock detected in sets_pkey'));
      await expect(service.logWorkout(TRAINER, CLIENT, logDto())).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('links', () => {
    it('lets a client accept a pending request', async () => {
      const { mock, service } = setup();
      mock.queue('trainer_clients', ok({ id: 'l1', status: 'pending', source: 'linked' }));
      mock.queue('trainer_clients', ok());
      mock.queue('trainer_actions', ok());

      await service.respondToRequest(CLIENT, TRAINER, 'accept');

      const update = mock.calls.find(
        (c) => c.target === 'trainer_clients' && c.method === 'update',
      );
      expect(update?.args[0]).toMatchObject({ status: 'active', ended_at: null });
    });

    it("lists a client's active trainers, with their display names", async () => {
      const { mock, service } = setup();
      mock.queue(
        'trainer_clients',
        ok([{ trainer_id: TRAINER, updated_at: '2026-10-01T00:00:00.000Z' }]),
      );
      mock.queue('users', ok([{ id: TRAINER, display_name: 'Coach Jo' }]));

      await expect(service.listMyTrainers(CLIENT)).resolves.toEqual([
        {
          trainerId: TRAINER,
          trainerDisplayName: 'Coach Jo',
          requestedAt: '2026-10-01T00:00:00.000Z',
        },
      ]);
      const filter = mock.calls.find((c) => c.target === 'trainer_clients' && c.method === 'eq');
      expect(filter?.args).toEqual(['client_id', CLIENT]);
    });

    it('404s when there is no pending request to answer', async () => {
      const { mock, service } = setup();
      mock.queue('trainer_clients', ok(null));
      await expect(service.respondToRequest(CLIENT, TRAINER, 'accept')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuses to end a link on behalf of someone who is neither party', async () => {
      const { mock, service } = setup();
      await expect(service.endLink(NEW_CLIENT, TRAINER, CLIENT)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mock.calls.length).toBe(0);
    });

    it('lets either party end an active link', async () => {
      const { mock, service } = setup();
      mock.queue('trainer_clients', ok({ id: 'l1', status: 'active', source: 'linked' }));
      mock.queue('trainer_clients', ok());
      mock.queue('trainer_actions', ok());

      await service.endLink(CLIENT, TRAINER, CLIENT);

      const audit = mock.calls.find((c) => c.target === 'trainer_actions' && c.method === 'insert');
      expect(audit?.args[0]).toMatchObject({
        action: 'link.ended',
        details: { endedBy: 'client' },
      });
    });
  });
});

describe('TrainerService: clients without an account', () => {
  const PLACEHOLDER = '55555555-5555-4555-8555-555555555555';
  const future = () => new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

  describe('trackClient', () => {
    it('creates a placeholder account nobody can sign in to, links it as managed, and returns a claim code', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queueCreate(ok({ user: { id: PLACEHOLDER } }));
      mock.queue('users', ok());
      mock.queue('trainer_clients', ok());
      mock.queue('trainer_placeholder_clients', ok());
      mock.queue('trainer_actions', ok());

      const result = await service.trackClient(TRAINER, {
        displayName: 'Pat',
        heightValue: 170,
        heightUnit: 'cm',
      });

      expect(result.clientId).toBe(PLACEHOLDER);
      expect(result.claimCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      const account = mock.calls.find((c) => c.method === 'createUser');
      expect((account?.args[0] as { email: string }).email).toMatch(/@placeholders\.invalid$/);
      const link = mock.calls.find((c) => c.target === 'trainer_clients' && c.method === 'insert');
      expect(link?.args[0]).toEqual({
        trainer_id: TRAINER,
        client_id: PLACEHOLDER,
        status: 'active',
        source: 'managed',
      });
    });

    it('stores only a hash of the code, never the code itself', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queueCreate(ok({ user: { id: PLACEHOLDER } }));
      mock.queue('users', ok());
      mock.queue('trainer_clients', ok());
      mock.queue('trainer_placeholder_clients', ok());
      mock.queue('trainer_actions', ok());

      const result = await service.trackClient(TRAINER, { displayName: 'Pat' });

      const stored = mock.calls.find(
        (c) => c.target === 'trainer_placeholder_clients' && c.method === 'insert',
      );
      const row = stored?.args[0] as { code_hash: string };
      expect(row.code_hash).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(stored?.args)).not.toContain(result.claimCode);
    });
  });

  describe('regenerateClaimCode', () => {
    it('issues a new code for a tracked client, replacing the stored hash', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_clients', ok({ id: 'l1', status: 'active', source: 'managed' }));
      mock.queue('trainer_placeholder_clients', ok({ id: 'p1' }), ok());
      mock.queue('trainer_actions', ok());

      const result = await service.regenerateClaimCode(TRAINER, PLACEHOLDER);

      expect(result.claimCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      const update = mock.calls.find(
        (c) => c.target === 'trainer_placeholder_clients' && c.method === 'update',
      );
      expect((update?.args[0] as { code_hash: string }).code_hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('refuses a client with no history waiting to be claimed', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queue('trainer_clients', ok({ id: 'l1', status: 'active', source: 'linked' }));
      mock.queue('trainer_placeholder_clients', ok(null));
      await expect(service.regenerateClaimCode(TRAINER, CLIENT)).rejects.toThrow(NotFoundException);
    });
  });

  describe('claimHistory', () => {
    it('moves the history to the client, deletes the placeholder, and records the claim', async () => {
      const { mock, service } = setup();
      mock.queue(
        'trainer_placeholder_clients',
        ok({ trainer_id: TRAINER, placeholder_user_id: PLACEHOLDER, code_expires_at: future() }),
      );
      mock.queueRpc('claim_placeholder_history', ok(3));
      mock.queue('trainer_actions', ok());

      await expect(service.claimHistory(CLIENT, 'abcd-2345')).resolves.toEqual({ workouts: 3 });

      const rpc = mock.calls.find((c) => c.target === 'rpc:claim_placeholder_history');
      expect(rpc?.args[0]).toEqual({ p_placeholder: PLACEHOLDER, p_client: CLIENT });
      expect(mock.calls.some((c) => c.method === 'deleteUser' && c.args[0] === PLACEHOLDER)).toBe(
        true,
      );
      const lookup = mock.calls.find(
        (c) => c.target === 'trainer_placeholder_clients' && c.method === 'eq',
      );
      expect(lookup?.args[0]).toBe('code_hash');
    });

    it('answers a wrong code with a single message', async () => {
      const { mock, service } = setup();
      mock.queue('trainer_placeholder_clients', ok(null));
      await expect(service.claimHistory(CLIENT, 'ABCD-2345')).rejects.toThrow(BadRequestException);
      expect(mock.calls.some((c) => c.target === 'rpc:claim_placeholder_history')).toBe(false);
    });

    it('refuses an expired code, and says it has expired', async () => {
      const { mock, service } = setup();
      mock.queue(
        'trainer_placeholder_clients',
        ok({
          trainer_id: TRAINER,
          placeholder_user_id: PLACEHOLDER,
          code_expires_at: new Date(Date.now() - 1000).toISOString(),
        }),
      );
      await expect(service.claimHistory(CLIENT, 'ABCD-2345')).rejects.toThrow(/expired/);
    });

    it('refuses to let a trainer claim a client they track', async () => {
      const { mock, service } = setup();
      mock.queue(
        'trainer_placeholder_clients',
        ok({ trainer_id: CLIENT, placeholder_user_id: PLACEHOLDER, code_expires_at: future() }),
      );
      await expect(service.claimHistory(CLIENT, 'ABCD-2345')).rejects.toThrow(BadRequestException);
    });

    it('tells the client to finish their open workout, and leaves the placeholder alone', async () => {
      const { mock, service } = setup();
      mock.queue(
        'trainer_placeholder_clients',
        ok({ trainer_id: TRAINER, placeholder_user_id: PLACEHOLDER, code_expires_at: future() }),
      );
      mock.queueRpc(
        'claim_placeholder_history',
        fail('finish or cancel the open workout on your account first'),
      );
      await expect(service.claimHistory(CLIENT, 'ABCD-2345')).rejects.toThrow(/finish or cancel/);
      expect(mock.calls.some((c) => c.method === 'deleteUser')).toBe(false);
    });

    it('limits claim attempts per user, so a code cannot be guessed by trying many', async () => {
      const { mock, service } = setup();
      for (let i = 0; i < 10; i += 1) {
        mock.queue('trainer_placeholder_clients', ok(null));
      }
      for (let i = 0; i < 10; i += 1) {
        await expect(service.claimHistory(CLIENT, 'ABCD-2345')).rejects.toThrow(
          BadRequestException,
        );
      }
      await expect(service.claimHistory(CLIENT, 'ABCD-2345')).rejects.toMatchObject({
        status: 429,
      });
    });
  });
});

describe('TrainerService: cancelling a live session', () => {
  const WORKOUT = '12121212-1212-4212-8212-121212121212';

  it('refuses a client who is not one of the trainer’s active clients', async () => {
    const { mock, service } = setup();
    mock.queue('subscriptions', activeTrainer());
    mock.queue('trainer_clients', ok(null));

    await expect(service.cancelLiveWorkout(TRAINER, CLIENT, WORKOUT)).rejects.toThrow(
      ForbiddenException,
    );
    expect(mock.calls.some((c) => c.target === 'workouts')).toBe(false);
  });

  it('discards the open session: it is soft-deleted, not finished, and the cancel is recorded', async () => {
    const { mock, service } = setup();
    mock.queue('subscriptions', activeTrainer());
    mock.queue('trainer_clients', ok({ id: 'l1', status: 'active', source: 'managed' }));
    mock.queue('workouts', ok([{ id: WORKOUT }]));
    mock.queue('trainer_actions', ok());

    await expect(service.cancelLiveWorkout(TRAINER, CLIENT, WORKOUT)).resolves.toBeUndefined();

    const update = mock.calls.find((c) => c.target === 'workouts' && c.method === 'update');
    expect(update?.args[0]).toMatchObject({ deleted_at: expect.any(String) });
    expect(update?.args[0]).not.toHaveProperty('completed_at');
    const audit = mock.calls.find((c) => c.target === 'trainer_actions' && c.method === 'insert');
    expect(audit?.args[0]).toMatchObject({ action: 'live.cancelled', target_id: WORKOUT });
  });

  it('says there is no open session when none matches, rather than cancelling something else', async () => {
    const { mock, service } = setup();
    mock.queue('subscriptions', activeTrainer());
    mock.queue('trainer_clients', ok({ id: 'l1', status: 'active', source: 'managed' }));
    mock.queue('workouts', ok([]));

    await expect(service.cancelLiveWorkout(TRAINER, CLIENT, WORKOUT)).rejects.toThrow(
      NotFoundException,
    );
  });
});
