import type { SupabaseService } from '../supabase/supabase.service';
import type { ExpoPushProvider } from './providers/expo-push.provider';
import { recordRule, SocialPushService, type SocialEvent } from './social-push.service';

const ME = '11111111-1111-4111-8111-111111111111';
const SAM = '22222222-2222-4222-8222-222222222222';
const WORKOUT = '33333333-3333-4333-8333-333333333333';
const NOTE = '44444444-4444-4444-8444-444444444444';
const COMMENT = '55555555-5555-4555-8555-555555555555';

interface Setup {
  recipient?: Record<string, unknown> | null;
  actor?: Record<string, unknown> | null;
  tokens?: string[];
  blocks?: { blocker_id: string; blocked_id: string }[];
  recorded?: Record<string, unknown> | null;
  invalidTokens?: string[];
}

function setup({
  recipient = { push_notifications_opt_in: true, notify_likes: true, notify_comments: true },
  actor = { display_name: 'Harbir', username: 'harbir' },
  tokens = ['ExponentPushToken[a]', 'ExponentPushToken[b]'],
  blocks = [],
  recorded = { notification_id: NOTE, should_push: true, actor_count: 1, unread: 3 },
  invalidTokens = [],
}: Setup = {}) {
  const deleted: unknown[][] = [];
  const rpc = jest.fn(async () => ({ data: recorded ? [recorded] : [], error: null }));
  const from = jest.fn((table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    let userId: string | null = null;
    b.select = jest.fn(() => b);
    b.or = jest.fn(() => b);
    b.eq = jest.fn((column: string, value: string) => {
      if (column === 'id') userId = value;
      return b;
    });
    b.delete = jest.fn(() => b);
    b.in = jest.fn((_column: string, values: unknown[]) => {
      deleted.push(values);
      return b;
    });
    const result = () => {
      if (table === 'user_blocks') return { data: blocks, error: null };
      if (table === 'device_push_tokens') {
        return { data: tokens.map((t) => ({ expo_push_token: t })), error: null };
      }
      if (table === 'users') return { data: userId === ME ? recipient : actor, error: null };
      return { data: null, error: null };
    };
    b.maybeSingle = jest.fn(async () => result());
    b.then = (ok: (r: unknown) => unknown) => Promise.resolve(result()).then(ok);
    return b;
  });
  const sendAll = jest.fn().mockResolvedValue({ invalidTokens });
  const service = new SocialPushService(
    { getClient: () => ({ from, rpc }) } as unknown as SupabaseService,
    { sendAll } as unknown as ExpoPushProvider,
  );
  return { service, sendAll, rpc, deleted };
}

const like: SocialEvent = {
  type: 'workout_like',
  recipientId: ME,
  actorId: SAM,
  workoutId: WORKOUT,
};

describe('SocialPushService', () => {
  it('records the event once, then pushes it to every device with what a tap needs', async () => {
    const { service, sendAll, rpc } = setup({ actor: { display_name: 'Sam', username: 'sam' } });

    await service.record(like);

    expect(rpc).toHaveBeenCalledWith(
      'record_social_notification',
      expect.objectContaining({
        p_recipient: ME,
        p_actor: SAM,
        p_type: 'workout_like',
        p_dedupe_key: `workout_like:${WORKOUT}`,
        p_cooldown: '30 minutes',
        p_workout_id: WORKOUT,
      }),
    );
    const message = {
      title: 'New workout like',
      body: 'Sam liked your workout. Keep up the great work!',
      badge: 3,
      data: {
        url: `progresso://workouts/${WORKOUT}`,
        type: 'workout_like',
        notificationId: NOTE,
        actorId: SAM,
        recipientId: ME,
        workoutId: WORKOUT,
      },
    };
    expect(sendAll).toHaveBeenCalledWith([
      { to: 'ExponentPushToken[a]', ...message },
      { to: 'ExponentPushToken[b]', ...message },
    ]);
  });

  it('groups likes: "Sam and 2 others"', async () => {
    const { service, sendAll } = setup({
      actor: { display_name: 'Sam', username: 'sam' },
      recorded: { notification_id: NOTE, should_push: true, actor_count: 3, unread: 1 },
    });
    await service.record(like);
    expect(sendAll.mock.calls[0][0][0].body).toBe(
      'Sam and 2 others liked your workout. Keep up the great work!',
    );
  });

  it('sends nothing the record says is not due -- a repeat, or within the cooldown', async () => {
    const { service, sendAll } = setup({
      recorded: { notification_id: NOTE, should_push: false, actor_count: 1, unread: 1 },
    });
    await service.record(like);
    expect(sendAll).not.toHaveBeenCalled();
  });

  it('never records or pushes your own action, a bad id, or anything across a block', async () => {
    const own = setup();
    await own.service.record({ ...like, actorId: ME });
    expect(own.rpc).not.toHaveBeenCalled();

    const bad = setup();
    await bad.service.record({ ...like, workoutId: 'not-an-id' });
    expect(bad.rpc).not.toHaveBeenCalled();

    const blocked = setup({ blocks: [{ blocker_id: ME, blocked_id: SAM }] });
    await blocked.service.record(like);
    expect(blocked.rpc).not.toHaveBeenCalled();
    expect(blocked.sendAll).not.toHaveBeenCalled();
  });

  it('keeps the record but pushes nothing with that kind switched off, notifications declined, or no device', async () => {
    const off = setup({ recipient: { push_notifications_opt_in: true, notify_likes: false } });
    const declined = setup({ recipient: { push_notifications_opt_in: false, notify_likes: true } });
    const noDevice = setup({ tokens: [] });

    for (const { service, rpc, sendAll } of [off, declined, noDevice]) {
      await service.record(like);
      expect(rpc).toHaveBeenCalled();
      expect(sendAll).not.toHaveBeenCalled();
    }
  });

  it('opens a comment at the comments, quoting its opening words', async () => {
    const { service, sendAll } = setup();
    await service.record({
      type: 'workout_comment',
      recipientId: ME,
      actorId: SAM,
      workoutId: WORKOUT,
      commentId: COMMENT,
      text: 'Great   session!\nKeep going',
    });
    const sent = sendAll.mock.calls[0][0][0];
    expect(sent.title).toBe('New workout comment');
    expect(sent.body).toBe('Harbir commented on your workout: "Great session! Keep going"');
    expect(sent.data.url).toBe(`progresso://workouts/${WORKOUT}?focusComments=true`);
    expect(sent.data.commentId).toBe(COMMENT);
  });

  it('forgets devices Expo says are gone', async () => {
    const { service, deleted } = setup({ invalidTokens: ['ExponentPushToken[b]'] });
    await service.record(like);
    expect(deleted).toContainEqual(['ExponentPushToken[b]']);
  });

  it('never fails what caused it', async () => {
    const { service, sendAll } = setup();
    sendAll.mockRejectedValue(new Error('Expo is down'));
    await expect(service.record(like)).resolves.toBeUndefined();
  });
});

describe('recordRule', () => {
  it('never groups follow requests or invitations away, only holds back a quick repeat', () => {
    expect(
      recordRule({ type: 'follow_request', recipientId: ME, actorId: SAM, followId: NOTE }),
    ).toEqual({
      dedupeKey: `follow_request:${SAM}`,
      throttleKey: `follow_request:${SAM}`,
      cooldown: '24 hours',
      repeat: true,
    });
    expect(
      recordRule({
        type: 'workout_invite',
        recipientId: ME,
        actorId: SAM,
        groupId: WORKOUT,
        inviteId: NOTE,
      }),
    ).toMatchObject({
      dedupeKey: `workout_invite:${WORKOUT}`,
      repeat: true,
      cooldown: '30 seconds',
    });
  });

  it('groups likes by workout, and spaces one person’s comments on a workout', () => {
    expect(recordRule(like)).toMatchObject({ dedupeKey: `workout_like:${WORKOUT}`, repeat: false });
    expect(
      recordRule({
        type: 'workout_comment',
        recipientId: ME,
        actorId: SAM,
        workoutId: WORKOUT,
        commentId: COMMENT,
        text: 'Nice',
      }),
    ).toEqual({
      dedupeKey: `workout_comment:${COMMENT}`,
      throttleKey: `workout_comment:${WORKOUT}:${SAM}`,
      cooldown: '2 minutes',
      repeat: false,
    });
  });
});
