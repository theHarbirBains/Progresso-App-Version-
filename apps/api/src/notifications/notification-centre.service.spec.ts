import type { SupabaseService } from '../supabase/supabase.service';
import { NotificationCentreService } from './notification-centre.service';

const ME = '11111111-1111-4111-8111-111111111111';
const SAM = '22222222-2222-4222-8222-222222222222';
const ALEX = '33333333-3333-4333-8333-333333333333';
const BLOCKED = '44444444-4444-4444-8444-444444444444';

type Result = { data: unknown; error: unknown };

/** Each table's answer -- the follows table answers twice (by id, then toward the actors). */
function setup(tables: Record<string, Result | Result[]>) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const used: Record<string, number> = {};
  const from = jest.fn((table: string) => {
    const answers = tables[table];
    const index = used[table] ?? 0;
    used[table] = index + 1;
    const result: Result = Array.isArray(answers)
      ? (answers[index] ?? answers[answers.length - 1] ?? { data: [], error: null })
      : (answers ?? { data: [], error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    for (const method of ['select', 'eq', 'is', 'in', 'or', 'order', 'limit', 'update']) {
      b[method] = jest.fn((...args: unknown[]) => {
        calls.push({ table, method, args });
        return b;
      });
    }
    b.then = (ok: (r: unknown) => unknown) => Promise.resolve(result).then(ok);
    return b;
  });
  const service = new NotificationCentreService({
    getClient: () => ({ from }),
  } as unknown as SupabaseService);
  return { service, calls };
}

const row = (extra: Record<string, unknown>) => ({
  id: 'n',
  actor_id: SAM,
  actor_count: 1,
  follow_id: null,
  workout_id: null,
  comment_id: null,
  group_id: null,
  invite_id: null,
  preview: null,
  event_at: '2026-11-27T10:00:00Z',
  read_at: null,
  ...extra,
});

const users = {
  data: [
    { id: SAM, username: 'sam', display_name: 'Sam', avatar_url: null },
    { id: ALEX, username: 'alex', display_name: null, avatar_url: null },
  ],
  error: null,
};

describe('NotificationCentreService', () => {
  it('lists their notifications in the push’s own words, with what’s become of each', async () => {
    const { service } = setup({
      notifications: {
        data: [
          row({ id: 'like', type: 'workout_like', workout_id: 'w1', actor_count: 3 }),
          row({ id: 'gone', type: 'workout_comment', workout_id: 'w2', preview: 'Nice' }),
          row({ id: 'req', type: 'follow_request', follow_id: 'f1', actor_id: ALEX }),
          row({ id: 'inv', type: 'workout_invite', group_id: 'g1', invite_id: 'm1' }),
        ],
        error: null,
      },
      user_blocks: { data: [], error: null },
      users,
      follows: [
        { data: [{ id: 'f1', status: 'pending' }], error: null },
        { data: [], error: null },
      ],
      workouts: {
        data: [
          { id: 'w1', deleted_at: null },
          { id: 'w2', deleted_at: '2026-11-27T11:00:00Z' },
        ],
        error: null,
      },
      workout_group_members: { data: [{ id: 'm1', status: 'invited' }], error: null },
      workout_groups: { data: [{ id: 'g1', name: 'Legs', status: 'finished' }], error: null },
    });

    const items = await service.list(ME);
    const byId = Object.fromEntries(items.map((item) => [item.id, item]));

    expect(byId.like).toMatchObject({
      title: 'New workout like',
      body: 'Sam and 2 others liked your workout. Keep up the great work!',
      read: false,
      available: true,
      path: 'workouts/w1',
    });
    // A deleted workout can't be opened.
    expect(byId.gone).toMatchObject({
      available: false,
      body: 'Sam commented on your workout: "Nice"',
    });
    // No name: @username.
    expect(byId.req).toMatchObject({
      body: '@alex wants to follow you. Check out their profile!',
      followStatus: 'pending',
      followingBack: 'none',
      available: true,
    });
    // The group finished before it was answered: expired.
    expect(byId.inv).toMatchObject({ inviteStatus: 'expired', available: false });
  });

  it('leaves out a withdrawn or declined request, and anyone blocked either way', async () => {
    const { service } = setup({
      notifications: {
        data: [
          row({ id: 'withdrawn', type: 'follow_request', follow_id: null }),
          row({ id: 'blocked', type: 'workout_like', workout_id: 'w1', actor_id: BLOCKED }),
          row({ id: 'kept', type: 'workout_like', workout_id: 'w1' }),
        ],
        error: null,
      },
      user_blocks: { data: [{ blocker_id: BLOCKED, blocked_id: ME }], error: null },
      users,
      workouts: { data: [{ id: 'w1', deleted_at: null }], error: null },
    });

    expect((await service.list(ME)).map((item) => item.id)).toEqual(['kept']);
  });

  it('counts only what it lists as unread', async () => {
    const { service } = setup({
      notifications: {
        data: [
          { type: 'workout_like', actor_id: SAM, follow_id: null },
          { type: 'follow_request', actor_id: SAM, follow_id: null },
          { type: 'workout_like', actor_id: BLOCKED, follow_id: null },
        ],
        error: null,
      },
      user_blocks: { data: [{ blocker_id: ME, blocked_id: BLOCKED }], error: null },
    });
    expect(await service.unreadCount(ME)).toBe(1);
  });

  it('marks only their own read -- these, or every one', async () => {
    const { service, calls } = setup({
      notifications: { data: [], error: null },
      user_blocks: { data: [], error: null },
    });
    await service.markRead(ME, ['a', 'b']);
    expect(calls).toContainEqual({
      table: 'notifications',
      method: 'eq',
      args: ['recipient_id', ME],
    });
    expect(calls).toContainEqual({
      table: 'notifications',
      method: 'in',
      args: ['id', ['a', 'b']],
    });

    calls.length = 0;
    await service.markRead(ME);
    expect(calls.some((c) => c.method === 'in')).toBe(false);
    expect(calls.some((c) => c.method === 'update')).toBe(true);
  });
});
