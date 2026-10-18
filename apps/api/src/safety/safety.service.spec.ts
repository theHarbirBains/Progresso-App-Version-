import { BadRequestException, NotFoundException } from '@nestjs/common';
import { FollowsService } from '../follows/follows.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { SafetyService } from './safety.service';

interface Result {
  data: unknown;
  error: { message: string } | null;
}

const CHAIN = ['select', 'eq', 'in', 'or', 'order', 'insert', 'delete'] as const;

/** Queues results per table (and per RPC), consumed in the order the service asks. Calls are recorded. */
function createMockClient() {
  const queues = new Map<string, Result[]>();
  const calls: { target: string; method: string; args: unknown[] }[] = [];
  const take = (name: string): Promise<Result> => {
    const next = queues.get(name)?.shift();
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
    builder.maybeSingle = jest.fn(() => take(table));
    builder.single = jest.fn(() => take(table));
    builder.then = (ok: (r: Result) => unknown, err?: (e: unknown) => unknown) =>
      take(table).then(ok, err);
    return builder;
  }

  return {
    client: {
      from: jest.fn((table: string) => builderFor(table)),
      rpc: jest.fn((fn: string, args: unknown) => {
        calls.push({ target: `rpc:${fn}`, method: 'rpc', args: [args] });
        return take(`rpc:${fn}`);
      }),
    },
    calls,
    queue(name: string, ...results: Result[]) {
      queues.set(name, [...(queues.get(name) ?? []), ...results]);
    },
  };
}

const ok = (data: unknown = null): Result => ({ data, error: null });
const ME = '11111111-1111-4111-8111-111111111111';
const THEM = '22222222-2222-4222-8222-222222222222';
const WORKOUT = '33333333-3333-4333-8333-333333333333';

function setup() {
  const mock = createMockClient();
  const supabase = { getClient: () => mock.client } as unknown as SupabaseService;
  return { mock, service: new SafetyService(supabase, new FollowsService(supabase)) };
}

describe('SafetyService', () => {
  describe('block', () => {
    it('blocks through block_user, which also removes what connects the two people', async () => {
      const { mock, service } = setup();
      mock.queue('users', ok({ id: THEM }));
      mock.queue('rpc:block_user', ok());

      await service.block(ME, THEM);

      const rpc = mock.calls.find((c) => c.target === 'rpc:block_user');
      expect(rpc?.args[0]).toEqual({ p_blocker: ME, p_blocked: THEM });
    });

    it('refuses blocking yourself before touching the database', async () => {
      const { mock, service } = setup();
      await expect(service.block(ME, ME)).rejects.toThrow(BadRequestException);
      expect(mock.calls).toHaveLength(0);
    });

    it('reports someone who does not exist', async () => {
      const { mock, service } = setup();
      mock.queue('users', ok(null));
      await expect(service.block(ME, THEM)).rejects.toThrow(NotFoundException);
      expect(mock.calls.some((c) => c.target === 'rpc:block_user')).toBe(false);
    });
  });

  it('unblocks only your own block', async () => {
    const { mock, service } = setup();
    mock.queue('user_blocks', ok());

    await service.unblock(ME, THEM);

    const filters = mock.calls.filter((c) => c.target === 'user_blocks' && c.method === 'eq');
    expect(filters.map((c) => c.args)).toEqual([
      ['blocker_id', ME],
      ['blocked_id', THEM],
    ]);
  });

  it('lists the people you blocked with their names, newest first', async () => {
    const { mock, service } = setup();
    mock.queue('user_blocks', ok([{ blocked_id: THEM }]));
    mock.queue('users', ok([{ id: THEM, username: 'sam', display_name: 'Sam', avatar_url: null }]));

    await expect(service.listBlocked(ME)).resolves.toEqual([
      { id: THEM, username: 'sam', displayName: 'Sam', avatarUrl: null },
    ]);
    const order = mock.calls.find((c) => c.target === 'user_blocks' && c.method === 'order');
    expect(order?.args).toEqual(['created_at', { ascending: false }]);
  });

  describe('report', () => {
    it('records a report about a person, with the reason and details', async () => {
      const { mock, service } = setup();
      mock.queue('users', ok({ id: THEM }));
      mock.queue('user_reports', ok({ id: 'report-1' }));

      await expect(
        service.report(ME, { reportedUserId: THEM, reason: 'harassment', details: 'Rude' }),
      ).resolves.toEqual({ id: 'report-1' });

      const insert = mock.calls.find((c) => c.target === 'user_reports' && c.method === 'insert');
      expect(insert?.args[0]).toEqual({
        reporter_id: ME,
        reported_user_id: THEM,
        workout_id: null,
        reason: 'harassment',
        details: 'Rude',
      });
    });

    it("records a report about one of the person's workouts", async () => {
      const { mock, service } = setup();
      mock.queue('users', ok({ id: THEM }));
      mock.queue('workouts', ok({ id: WORKOUT }));
      mock.queue('user_reports', ok({ id: 'report-2' }));

      await service.report(ME, { reportedUserId: THEM, workoutId: WORKOUT, reason: 'spam' });

      const owner = mock.calls.filter((c) => c.target === 'workouts' && c.method === 'eq');
      expect(owner.map((c) => c.args)).toEqual([
        ['id', WORKOUT],
        ['user_id', THEM],
      ]);
      const insert = mock.calls.find((c) => c.target === 'user_reports' && c.method === 'insert');
      expect(insert?.args[0]).toMatchObject({ workout_id: WORKOUT, details: null });
    });

    it("refuses a workout that isn't the reported person's", async () => {
      const { mock, service } = setup();
      mock.queue('users', ok({ id: THEM }));
      mock.queue('workouts', ok(null));

      await expect(
        service.report(ME, { reportedUserId: THEM, workoutId: WORKOUT, reason: 'spam' }),
      ).rejects.toThrow(NotFoundException);
      expect(mock.calls.some((c) => c.target === 'user_reports')).toBe(false);
    });

    it('refuses reporting yourself', async () => {
      const { service } = setup();
      await expect(service.report(ME, { reportedUserId: ME, reason: 'other' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
