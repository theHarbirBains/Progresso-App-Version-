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
] as const;

/**
 * Supabase stand-in for these tests. Results are queued per table (and per
 * rpc name, for rpc), and consumed in the order the service issues queries.
 * Every call is recorded so tests can assert what was written.
 */
function createMockClient() {
  const queues = new Map<string, Result[]>();
  const rpcQueues = new Map<string, Result[]>();
  const adminQueue: Result[] = [];
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

  describe('addClient', () => {
    it('refuses to add yourself', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queueRpc('find_auth_user_id_by_email', ok(TRAINER));
      await expect(
        service.addClient(TRAINER, { email: 'me@b.co' } as AddClientDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('sends an existing account a pending link request, without creating an account', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queueRpc('find_auth_user_id_by_email', ok(CLIENT));
      mock.queue('trainer_clients', ok(null), ok({ id: 'link-1' }));
      mock.queue('trainer_actions', ok());

      const result = await service.addClient(TRAINER, {
        email: 'Client@Example.com',
        displayName: 'Ignored',
      } as AddClientDto);

      expect(result).toEqual({ clientId: CLIENT, status: 'pending', source: 'linked' });
      expect(mock.client.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
      const rpcCall = mock.calls.find((c) => c.target === 'rpc:find_auth_user_id_by_email');
      expect(rpcCall?.args[0]).toEqual({ p_email: 'client@example.com' });
    });

    it('re-requests an ended link as linked, so a trainer never keeps edit rights to an account the client owns', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queueRpc('find_auth_user_id_by_email', ok(CLIENT));
      mock.queue('trainer_clients', ok({ id: 'link-1', status: 'ended', source: 'managed' }), ok());
      mock.queue('trainer_actions', ok());

      const result = await service.addClient(TRAINER, { email: 'c@example.com' } as AddClientDto);

      expect(result.status).toBe('pending');
      const update = mock.calls.find(
        (c) => c.target === 'trainer_clients' && c.method === 'update',
      );
      expect(update?.args[0]).toMatchObject({ status: 'pending', source: 'linked' });
    });

    it('creates a managed client from a new email, sets its profile, and links it as active', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queueRpc('find_auth_user_id_by_email', ok(null));
      mock.queueInvite({ data: { user: { id: NEW_CLIENT } }, error: null });
      mock.queue('users', ok());
      mock.queue('trainer_clients', ok());
      mock.queue('trainer_actions', ok());

      const result = await service.addClient(TRAINER, {
        email: 'new@example.com',
        displayName: 'Sam',
        heightValue: 180,
        heightUnit: 'cm',
        weightValue: 80,
        weightUnit: 'kg',
      } as AddClientDto);

      expect(result).toEqual({ clientId: NEW_CLIENT, status: 'active', source: 'managed' });
      const invite = mock.calls.find((c) => c.method === 'inviteUserByEmail');
      expect(invite?.args[1]).toEqual({
        data: { display_name: 'Sam', managed_by_trainer: true },
      });
      const profile = mock.calls.find((c) => c.target === 'users' && c.method === 'update');
      expect(profile?.args[0]).toMatchObject({
        display_name: 'Sam',
        height_value: 180,
        height_unit: 'cm',
        weight_value: 80,
        weight_unit: 'kg',
      });
      const link = mock.calls.find((c) => c.target === 'trainer_clients' && c.method === 'insert');
      expect(link?.args[0]).toEqual({
        trainer_id: TRAINER,
        client_id: NEW_CLIENT,
        status: 'active',
        source: 'managed',
      });
    });

    it('requires a name before inviting a new email', async () => {
      const { mock, service } = setup();
      mock.queue('subscriptions', activeTrainer());
      mock.queueRpc('find_auth_user_id_by_email', ok(null));
      await expect(
        service.addClient(TRAINER, { email: 'new@example.com' } as AddClientDto),
      ).rejects.toThrow(BadRequestException);
      expect(mock.client.auth.admin.inviteUserByEmail).not.toHaveBeenCalled();
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
