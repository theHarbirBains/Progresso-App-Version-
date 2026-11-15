import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { FollowsService } from '../follows/follows.service';
import type { SupabaseService } from '../supabase/supabase.service';
import { SharedExercisesService } from './shared-exercises.service';

interface QueuedResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

const CHAIN_METHODS = ['select', 'eq', 'in', 'is', 'or', 'order', 'insert'] as const;

/** The same per-table FIFO query-builder mock as feed.service.spec.ts, with inserts recorded. */
function createMockClient() {
  const queues = new Map<string, QueuedResult[]>();
  const inserts: { table: string; row: unknown }[] = [];

  function queue(table: string, result: QueuedResult) {
    const existing = queues.get(table) ?? [];
    existing.push(result);
    queues.set(table, existing);
  }

  function nextResult(table: string): QueuedResult {
    const result = queues.get(table)?.shift();
    if (!result) throw new Error(`No queued result for table "${table}"`);
    return result;
  }

  function makeBuilder(table: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder: any = {};
    for (const method of CHAIN_METHODS) {
      builder[method] = jest.fn((...args: unknown[]) => {
        if (method === 'insert') inserts.push({ table, row: args[0] });
        return builder;
      });
    }
    builder.maybeSingle = jest.fn(async () => nextResult(table));
    builder.single = jest.fn(async () => nextResult(table));
    builder.then = (
      onFulfilled: (r: QueuedResult) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(nextResult(table)).then(onFulfilled, onRejected);
    return builder;
  }

  const from = jest.fn((table: string) => makeBuilder(table));
  return { from, queue, inserts };
}

function serviceWith(client: ReturnType<typeof createMockClient>) {
  const supabaseService = { getClient: () => client } as unknown as SupabaseService;
  return new SharedExercisesService(supabaseService, new FollowsService(supabaseService));
}

function exerciseRow(id: string, owner: string | null, extra: Record<string, unknown> = {}) {
  return {
    id,
    name: 'Seated Row',
    muscle_group: 'back',
    movement_type: 'bilateral',
    logging_style: null,
    measurement_type: 'weight_reps',
    photo_url: 'https://example.com/row.jpg',
    gym: 'Fit4Less Downtown',
    feel_notes: 'Heavier than the one at home',
    attachment: 'V-handle',
    load_type: 'single_stack',
    pulley: 'heavier',
    is_active: true,
    created_by: owner,
    created_at: '2026-11-01T00:00:00.000Z',
    updated_at: '2026-11-01T00:00:00.000Z',
    ...extra,
  };
}

/** The read of the exercises shared with user-1: the one filtered by who made them. */
function sharedRead(client: ReturnType<typeof createMockClient>) {
  return client.from.mock.results.find(
    (result, i) =>
      client.from.mock.calls[i]?.[0] === 'exercises' && result.value.in.mock.calls.length > 0,
  )?.value;
}

/** Who shares with user-1: their trainer, a client of theirs, a tracked client, and a followee. */
function queueSharers(
  client: ReturnType<typeof createMockClient>,
  { blocks = [] as { blocker_id: string; blocked_id: string }[] } = {},
) {
  client.queue('trainer_clients', {
    data: [
      { trainer_id: 'coach', client_id: 'user-1' },
      { trainer_id: 'user-1', client_id: 'client-a' },
      { trainer_id: 'user-1', client_id: 'tracked' },
    ],
    error: null,
  });
  client.queue('follows', {
    data: [{ followee_id: 'sam' }, { followee_id: 'coach' }],
    error: null,
  });
  client.queue('user_blocks', { data: blocks, error: null });
  client.queue('trainer_placeholder_clients', {
    data: [{ placeholder_user_id: 'tracked' }],
    error: null,
  });
}

describe('SharedExercisesService', () => {
  describe('list', () => {
    it("lists a trainer's, a client's and a followee's exercises, each with how it's shared", async () => {
      const client = createMockClient();
      queueSharers(client);
      // user-1's own exercises are read first (a Seated Row at the same gym already), then the
      // shared ones.
      client.queue('exercises', {
        data: [exerciseRow('ex-mine', 'user-1', { gym: 'fit4less downtown' })],
        error: null,
      });
      client.queue('exercises', {
        data: [
          exerciseRow('ex-coach', 'coach', { name: 'Hack Squat', gym: null }),
          exerciseRow('ex-client', 'client-a', { name: 'Leg Press' }),
          exerciseRow('ex-sam', 'sam'),
        ],
        error: null,
      });
      client.queue('users', {
        data: [
          { id: 'coach', username: 'coach', display_name: 'Coach', avatar_url: null },
          { id: 'sam', username: 'sam', display_name: 'Sam', avatar_url: null },
        ],
        error: null,
      });
      const service = serviceWith(client);

      const shared = await service.list('user-1');

      expect(shared.map((e) => [e.id, e.source, e.inLibrary])).toEqual([
        // Followed as well as their trainer: reads as the trainer.
        ['ex-coach', 'trainer', false],
        ['ex-client', 'client', false],
        // A Seated Row at that gym is already theirs (case aside).
        ['ex-sam', 'friend', true],
      ]);
      expect(shared[2]).toMatchObject({
        owner: { id: 'sam', displayName: 'Sam' },
        gym: 'Fit4Less Downtown',
        attachment: 'V-handle',
      });
      // An old note on how it feels stays with its owner.
      expect(shared[2]).not.toHaveProperty('feelNotes');
      // A tracked client is no one to share with: its exercises aren't read.
      expect(sharedRead(client).in).toHaveBeenCalledWith('created_by', [
        'coach',
        'client-a',
        'sam',
      ]);
    });

    it('shares nothing with someone blocked either way', async () => {
      const client = createMockClient();
      queueSharers(client, {
        blocks: [
          { blocker_id: 'user-1', blocked_id: 'sam' },
          { blocker_id: 'client-a', blocked_id: 'user-1' },
        ],
      });
      client.queue('exercises', { data: [], error: null });
      client.queue('exercises', { data: [], error: null });
      client.queue('users', { data: [], error: null });
      const service = serviceWith(client);

      await service.list('user-1');

      expect(sharedRead(client).in).toHaveBeenCalledWith('created_by', ['coach']);
    });

    it('reads no exercises when nobody shares with them', async () => {
      const client = createMockClient();
      client.queue('trainer_clients', { data: [], error: null });
      client.queue('follows', { data: [], error: null });
      client.queue('user_blocks', { data: [], error: null });
      const service = serviceWith(client);

      await expect(service.list('user-1')).resolves.toEqual([]);
      expect(client.from).not.toHaveBeenCalledWith('exercises');
    });
  });

  describe('copy', () => {
    it("copies a friend's exercise into their library, with everything that sets it apart", async () => {
      const client = createMockClient();
      client.queue('exercises', { data: exerciseRow('ex-sam', 'sam'), error: null });
      queueSharers(client);
      client.queue('exercises', { data: [], error: null });
      client.queue('exercises', { data: exerciseRow('ex-copy', 'user-1'), error: null });
      const service = serviceWith(client);

      const copied = await service.copy('user-1', 'ex-sam');

      expect(copied).toMatchObject({ id: 'ex-copy', createdBy: 'user-1' });
      expect(client.inserts).toEqual([
        {
          table: 'exercises',
          row: {
            created_by: 'user-1',
            name: 'Seated Row',
            muscle_group: 'back',
            movement_type: 'bilateral',
            logging_style: null,
            measurement_type: 'weight_reps',
            photo_url: 'https://example.com/row.jpg',
            gym: 'Fit4Less Downtown',
            attachment: 'V-handle',
            load_type: 'single_stack',
            pulley: 'heavier',
          },
        },
      ]);
    });

    it('returns their own exercise by that name at that gym instead of a second copy', async () => {
      const client = createMockClient();
      client.queue('exercises', { data: exerciseRow('ex-coach', 'coach'), error: null });
      queueSharers(client);
      client.queue('exercises', {
        data: [exerciseRow('ex-mine', 'user-1', { name: 'seated row ' })],
        error: null,
      });
      const service = serviceWith(client);

      await expect(service.copy('user-1', 'ex-coach')).resolves.toMatchObject({ id: 'ex-mine' });
      expect(client.inserts).toEqual([]);
    });

    it('makes a copy when their same-named exercise is held another way', async () => {
      const client = createMockClient();
      client.queue('exercises', { data: exerciseRow('ex-coach', 'coach'), error: null });
      queueSharers(client);
      client.queue('exercises', {
        data: [exerciseRow('ex-mine', 'user-1', { attachment: 'Wide grip' })],
        error: null,
      });
      client.queue('exercises', { data: exerciseRow('ex-copy', 'user-1'), error: null });
      const service = serviceWith(client);

      await expect(service.copy('user-1', 'ex-coach')).resolves.toMatchObject({ id: 'ex-copy' });
      expect(client.inserts).toHaveLength(1);
    });

    it('makes a copy when their same-named exercise is loaded another way', async () => {
      const client = createMockClient();
      client.queue('exercises', { data: exerciseRow('ex-coach', 'coach'), error: null });
      queueSharers(client);
      client.queue('exercises', {
        data: [exerciseRow('ex-mine', 'user-1', { load_type: 'plate_loaded', pulley: null })],
        error: null,
      });
      client.queue('exercises', { data: exerciseRow('ex-copy', 'user-1'), error: null });
      const service = serviceWith(client);

      await expect(service.copy('user-1', 'ex-coach')).resolves.toMatchObject({ id: 'ex-copy' });
      expect(client.inserts).toHaveLength(1);
    });

    it('returns a built-in, or one of their own, as it is', async () => {
      const client = createMockClient();
      client.queue('exercises', { data: exerciseRow('ex-built-in', null), error: null });
      client.queue('exercises', { data: exerciseRow('ex-mine', 'user-1'), error: null });
      const service = serviceWith(client);

      await expect(service.copy('user-1', 'ex-built-in')).resolves.toMatchObject({
        id: 'ex-built-in',
      });
      await expect(service.copy('user-1', 'ex-mine')).resolves.toMatchObject({ id: 'ex-mine' });
      expect(client.from).not.toHaveBeenCalledWith('trainer_clients');
    });

    it("refuses an exercise that isn't shared with them, and one that's been deleted", async () => {
      const client = createMockClient();
      client.queue('exercises', { data: exerciseRow('ex-stranger', 'stranger'), error: null });
      queueSharers(client);
      client.queue('exercises', {
        data: exerciseRow('ex-gone', 'sam', { is_active: false }),
        error: null,
      });
      client.queue('exercises', { data: null, error: null });
      const service = serviceWith(client);

      await expect(service.copy('user-1', 'ex-stranger')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.copy('user-1', 'ex-gone')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.copy('user-1', 'ex-missing')).rejects.toBeInstanceOf(NotFoundException);
      expect(client.inserts).toEqual([]);
    });

    it('returns the one just added elsewhere when the copy races another', async () => {
      const client = createMockClient();
      client.queue('exercises', { data: exerciseRow('ex-sam', 'sam'), error: null });
      queueSharers(client);
      client.queue('exercises', { data: [], error: null });
      client.queue('exercises', { data: null, error: { code: '23505', message: 'duplicate' } });
      client.queue('exercises', { data: [exerciseRow('ex-raced', 'user-1')], error: null });
      const service = serviceWith(client);

      await expect(service.copy('user-1', 'ex-sam')).resolves.toMatchObject({ id: 'ex-raced' });
    });
  });
});
