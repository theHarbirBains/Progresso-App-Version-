import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { FollowsService } from './follows.service';

interface QueuedResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

const CHAIN_METHODS = [
  'select',
  'eq',
  'in',
  'ilike',
  'neq',
  'gte',
  'order',
  'limit',
  'insert',
  'update',
  'delete',
] as const;

/**
 * A generic Supabase query-builder mock, scoped to this spec file: every
 * chain method (`.eq`, `.select`, ...) returns the same builder, and the
 * builder resolves -- whether awaited directly or terminated with
 * `.maybeSingle()` -- to the next queued result for that table, in call
 * order. This is used instead of the exact-shape mocks users.service.spec.ts
 * / equipment-profiles.service.spec.ts hand-roll because FollowsService's
 * methods chain many different combinations of the same handful of
 * PostgREST methods; asserting the exact chain shape isn't this service's
 * interesting behavior the way it is for those two (see the request-body
 * assertions below, which still check the arguments that matter).
 */
function createMockClient() {
  const queues = new Map<string, QueuedResult[]>();
  const calls: { table: string; method: string; args: unknown[] }[] = [];

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
      builder[method] = jest.fn((...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      });
    }
    builder.maybeSingle = jest.fn(() => Promise.resolve(nextResult(table)));
    builder.then = (
      onFulfilled: (r: QueuedResult) => unknown,
      onRejected?: (e: unknown) => unknown,
    ) => Promise.resolve(nextResult(table)).then(onFulfilled, onRejected);
    return builder;
  }

  const from = jest.fn((table: string) => makeBuilder(table));
  return { from, queue, calls };
}

function serviceWith(client: ReturnType<typeof createMockClient>): FollowsService {
  const supabaseService = { getClient: () => client } as unknown as SupabaseService;
  return new FollowsService(supabaseService);
}

describe('FollowsService', () => {
  describe('sendRequest', () => {
    it('rejects following yourself before touching the database', async () => {
      const client = createMockClient();
      const service = serviceWith(client);

      await expect(service.sendRequest('user-1', 'user-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(client.from).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the target user does not exist', async () => {
      const client = createMockClient();
      client.queue('users', { data: null, error: null });
      const service = serviceWith(client);

      await expect(service.sendRequest('user-1', 'missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('creates a pending request when none exists yet', async () => {
      const client = createMockClient();
      client.queue('users', { data: { id: 'user-2' }, error: null });
      client.queue('follows', { data: null, error: null }); // no existing row
      client.queue('follows', { data: null, error: null }); // insert result
      const service = serviceWith(client);

      const result = await service.sendRequest('user-1', 'user-2');

      expect(result).toEqual({ status: 'pending' });
      const insertCall = client.calls.find((c) => c.table === 'follows' && c.method === 'insert');
      expect(insertCall?.args[0]).toEqual({
        follower_id: 'user-1',
        followee_id: 'user-2',
        status: 'pending',
      });
    });

    it('is idempotent -- reports the existing status instead of erroring on a duplicate request', async () => {
      const client = createMockClient();
      client.queue('users', { data: { id: 'user-2' }, error: null });
      client.queue('follows', { data: { status: 'accepted' }, error: null });
      const service = serviceWith(client);

      await expect(service.sendRequest('user-1', 'user-2')).resolves.toEqual({
        status: 'accepted',
      });
    });
  });

  describe('respondToRequest', () => {
    it('throws NotFoundException when the request does not exist', async () => {
      const client = createMockClient();
      client.queue('follows', { data: null, error: null });
      const service = serviceWith(client);

      await expect(service.respondToRequest('user-2', 'follow-1', 'accept')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('only lets the recipient (followee) respond', async () => {
      const client = createMockClient();
      client.queue('follows', {
        data: { id: 'follow-1', followee_id: 'user-2', status: 'pending' },
        error: null,
      });
      const service = serviceWith(client);

      await expect(
        service.respondToRequest('someone-else', 'follow-1', 'accept'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects responding twice to the same request', async () => {
      const client = createMockClient();
      client.queue('follows', {
        data: { id: 'follow-1', followee_id: 'user-2', status: 'accepted' },
        error: null,
      });
      const service = serviceWith(client);

      await expect(service.respondToRequest('user-2', 'follow-1', 'accept')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('accepting sets status to accepted', async () => {
      const client = createMockClient();
      client.queue('follows', {
        data: { id: 'follow-1', followee_id: 'user-2', status: 'pending' },
        error: null,
      });
      client.queue('follows', { data: null, error: null }); // update result
      const service = serviceWith(client);

      await service.respondToRequest('user-2', 'follow-1', 'accept');

      const updateCall = client.calls.find((c) => c.table === 'follows' && c.method === 'update');
      expect((updateCall?.args[0] as { status: string }).status).toBe('accepted');
    });

    it('rejecting deletes the row instead of leaving a rejected record', async () => {
      const client = createMockClient();
      client.queue('follows', {
        data: { id: 'follow-1', followee_id: 'user-2', status: 'pending' },
        error: null,
      });
      client.queue('follows', { data: null, error: null }); // delete result
      const service = serviceWith(client);

      await service.respondToRequest('user-2', 'follow-1', 'reject');

      expect(client.calls.some((c) => c.table === 'follows' && c.method === 'delete')).toBe(true);
    });
  });

  describe('unfollow', () => {
    it('deletes the follow row and is a no-op error-wise if nothing matched', async () => {
      const client = createMockClient();
      client.queue('follows', { data: null, error: null });
      const service = serviceWith(client);

      await expect(service.unfollow('user-1', 'user-2')).resolves.toBeUndefined();
    });
  });

  describe('search', () => {
    it('excludes the caller and reports follow status per result', async () => {
      const client = createMockClient();
      client.queue('users', {
        data: [{ id: 'user-2', username: 'harbir', display_name: 'Harbir', avatar_url: null }],
        error: null,
      });
      client.queue('users', { data: [], error: null });
      client.queue('follows', {
        data: [{ followee_id: 'user-2', status: 'pending' }],
        error: null,
      });
      const service = serviceWith(client);

      const results = await service.search('user-1', 'harb');

      expect(results).toEqual([
        {
          user: { id: 'user-2', username: 'harbir', displayName: 'Harbir', avatarUrl: null },
          status: 'pending',
        },
      ]);
    });

    it('returns an empty list without querying follow status when no user matches', async () => {
      const client = createMockClient();
      client.queue('users', { data: [], error: null });
      client.queue('users', { data: [], error: null });
      const service = serviceWith(client);

      await expect(service.search('user-1', 'nobody')).resolves.toEqual([]);
    });

    it('throws InternalServerErrorException when the query errors', async () => {
      const client = createMockClient();
      client.queue('users', { data: null, error: { message: 'connection lost' } });
      client.queue('users', { data: [], error: null });
      const service = serviceWith(client);

      await expect(service.search('user-1', 'harb')).rejects.toBeInstanceOf(
        InternalServerErrorException,
      );
    });
  });

  describe('listNotifications', () => {
    it('merges pending requests and recently-accepted follows, newest first', async () => {
      const client = createMockClient();
      client.queue('follows', {
        data: [{ id: 'follow-1', follower_id: 'user-2', created_at: '2026-01-01T00:00:00Z' }],
        error: null,
      });
      client.queue('follows', {
        data: [{ id: 'follow-2', followee_id: 'user-3', responded_at: '2026-01-05T00:00:00Z' }],
        error: null,
      });
      client.queue('users', {
        data: [{ id: 'user-2', username: 'jane', display_name: 'Jane', avatar_url: null }],
        error: null,
      });
      client.queue('users', {
        data: [{ id: 'user-3', username: 'bob', display_name: 'Bob', avatar_url: null }],
        error: null,
      });
      const service = serviceWith(client);

      const result = await service.listNotifications('user-1');

      expect(result).toEqual([
        {
          kind: 'accepted',
          followId: 'follow-2',
          at: '2026-01-05T00:00:00Z',
          user: { id: 'user-3', username: 'bob', displayName: 'Bob', avatarUrl: null },
        },
        {
          kind: 'request',
          followId: 'follow-1',
          at: '2026-01-01T00:00:00Z',
          user: { id: 'user-2', username: 'jane', displayName: 'Jane', avatarUrl: null },
        },
      ]);
    });

    it('returns an empty list when there is nothing pending or recently accepted', async () => {
      const client = createMockClient();
      client.queue('follows', { data: [], error: null });
      client.queue('follows', { data: [], error: null });
      const service = serviceWith(client);

      await expect(service.listNotifications('user-1')).resolves.toEqual([]);
    });
  });

  describe('listSuggested', () => {
    it('excludes users already followed or requested, and always reports status "none"', async () => {
      const client = createMockClient();
      client.queue('follows', { data: [{ followee_id: 'user-2' }], error: null });
      client.queue('users', {
        data: [
          {
            id: 'user-2',
            username: 'already',
            display_name: 'Already Following',
            avatar_url: null,
          },
          { id: 'user-3', username: 'new', display_name: 'New Person', avatar_url: null },
        ],
        error: null,
      });
      const service = serviceWith(client);

      const results = await service.listSuggested('user-1');

      expect(results).toEqual([
        {
          user: { id: 'user-3', username: 'new', displayName: 'New Person', avatarUrl: null },
          status: 'none',
        },
      ]);
    });

    it('overfetches by the excluded count so the final list can still reach the limit', async () => {
      const client = createMockClient();
      client.queue('follows', {
        data: [{ followee_id: 'user-2' }, { followee_id: 'user-3' }],
        error: null,
      });
      client.queue('users', { data: [], error: null });
      const service = serviceWith(client);

      await service.listSuggested('user-1');

      const limitCall = client.calls.find((c) => c.table === 'users' && c.method === 'limit');
      expect(limitCall?.args[0]).toBe(22); // SUGGESTED_LIMIT (20) + 2 excluded
    });

    it('returns an empty list when there is nothing left to suggest', async () => {
      const client = createMockClient();
      client.queue('follows', { data: [], error: null });
      client.queue('users', { data: [], error: null });
      const service = serviceWith(client);

      await expect(service.listSuggested('user-1')).resolves.toEqual([]);
    });
  });

  describe('listAcceptedFolloweeIds', () => {
    it('returns just the followee ids', async () => {
      const client = createMockClient();
      client.queue('follows', {
        data: [{ followee_id: 'user-2' }, { followee_id: 'user-3' }],
        error: null,
      });
      const service = serviceWith(client);

      await expect(service.listAcceptedFolloweeIds('user-1')).resolves.toEqual([
        'user-2',
        'user-3',
      ]);
    });
  });
});
