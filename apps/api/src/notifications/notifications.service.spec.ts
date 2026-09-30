import { InternalServerErrorException } from '@nestjs/common';
import type { SupabaseService } from '../supabase/supabase.service';
import { NotificationsService } from './notifications.service';
import type { ExpoPushProvider } from './providers/expo-push.provider';

interface Result {
  data: unknown;
  error: { message: string } | null;
}

// Every filter/chain method returns the same builder (so any call order
// works), and the builder is itself thenable -- matching real
// supabase-js PostgrestFilterBuilder. Each table gets its OWN builder
// (built fresh per .from() call), keyed by table name, so a test can
// configure a different canned result per table.
function createQueryBuilder(result: Result) {
  const methods = [
    'select',
    'eq',
    'in',
    'not',
    'is',
    'order',
    'gte',
    'limit',
    'insert',
    'upsert',
    'delete',
  ] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    builder[m] = jest.fn(() => builder);
  }
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function mockTables(byTable: Record<string, Result>) {
  const from = jest.fn((table: string) =>
    createQueryBuilder(byTable[table] ?? { data: null, error: null }),
  );
  const supabaseService = { getClient: () => ({ from }) } as unknown as SupabaseService;
  return { supabaseService, from };
}

function mockExpoPush(): ExpoPushProvider {
  return { sendAll: jest.fn().mockResolvedValue(undefined) } as unknown as ExpoPushProvider;
}

describe('NotificationsService -- token registration', () => {
  it('upserts a device push token', async () => {
    const { supabaseService, from } = mockTables({
      device_push_tokens: { data: null, error: null },
    });
    const service = new NotificationsService(supabaseService, mockExpoPush());

    await service.registerToken('user-1', 'ExponentPushToken[a]', 'ios');

    const builder = from.mock.results[0]!.value;
    expect(from).toHaveBeenCalledWith('device_push_tokens');
    expect(builder.upsert).toHaveBeenCalledWith(
      { user_id: 'user-1', expo_push_token: 'ExponentPushToken[a]', platform: 'ios' },
      { onConflict: 'user_id,expo_push_token' },
    );
  });

  it('throws when the upsert fails', async () => {
    const { supabaseService } = mockTables({
      device_push_tokens: { data: null, error: { message: 'boom' } },
    });
    const service = new NotificationsService(supabaseService, mockExpoPush());

    await expect(service.registerToken('user-1', 'tok', 'ios')).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('removes a device push token', async () => {
    const { supabaseService, from } = mockTables({
      device_push_tokens: { data: null, error: null },
    });
    const service = new NotificationsService(supabaseService, mockExpoPush());

    await service.unregisterToken('user-1', 'ExponentPushToken[a]');

    const builder = from.mock.results[0]!.value;
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(builder.eq).toHaveBeenCalledWith('expo_push_token', 'ExponentPushToken[a]');
  });
});

describe('NotificationsService.sendDailyNotifications', () => {
  it('sends nothing and makes no further queries when no one has a push token', async () => {
    const { supabaseService, from } = mockTables({
      device_push_tokens: { data: [], error: null },
    });
    const expoPush = mockExpoPush();
    const service = new NotificationsService(supabaseService, expoPush);

    const result = await service.sendDailyNotifications();

    expect(result).toEqual({ workoutRemindersSent: 0, foodRemindersSent: 0 });
    expect(expoPush.sendAll).not.toHaveBeenCalled();
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('sends a next-workout reminder to a user with an active split and no reminder yet today', async () => {
    const { supabaseService } = mockTables({
      device_push_tokens: {
        data: [{ user_id: 'user-1', expo_push_token: 'ExponentPushToken[a]' }],
        error: null,
      },
      users: {
        data: [{ id: 'user-1', display_name: 'Harbir', active_workout_split_id: 'split-1' }],
        error: null,
      },
      notification_log: { data: [], error: null },
      // Logged today -- isolates this test to the workout reminder alone;
      // the food-reminder path has its own dedicated tests below.
      food_logs: {
        data: [{ user_id: 'user-1', logged_at: new Date().toISOString() }],
        error: null,
      },
      workout_split_days: {
        data: [
          { id: 'day-push', name: 'Push', order_index: 1 },
          { id: 'day-pull', name: 'Pull', order_index: 2 },
        ],
        error: null,
      },
      workout_split_day_muscle_groups: {
        data: [{ workout_split_day_id: 'day-push', muscle_group: 'chest' }],
        error: null,
      },
      workouts: { data: null, error: null },
    });
    const expoPush = mockExpoPush();
    const service = new NotificationsService(supabaseService, expoPush);

    const result = await service.sendDailyNotifications();

    expect(result.workoutRemindersSent).toBe(1);
    expect(result.foodRemindersSent).toBe(0);
    expect(expoPush.sendAll).toHaveBeenCalledWith([
      {
        to: 'ExponentPushToken[a]',
        title: 'Time to train',
        body: "Come on Harbir, you've got chest waiting to be crushed.",
      },
    ]);
  });

  it('sends a food-log reminder to a user with no logs at all', async () => {
    const { supabaseService } = mockTables({
      device_push_tokens: {
        data: [{ user_id: 'user-1', expo_push_token: 'ExponentPushToken[a]' }],
        error: null,
      },
      users: {
        data: [{ id: 'user-1', display_name: 'Harbir', active_workout_split_id: null }],
        error: null,
      },
      notification_log: { data: [], error: null },
      food_logs: { data: [], error: null },
    });
    const expoPush = mockExpoPush();
    const service = new NotificationsService(supabaseService, expoPush);

    const result = await service.sendDailyNotifications();

    expect(result).toEqual({ workoutRemindersSent: 0, foodRemindersSent: 1 });
    expect(expoPush.sendAll).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[a]', title: 'Progresso' }),
    ]);
  });

  it('does not remind about food logged recently', async () => {
    const { supabaseService } = mockTables({
      device_push_tokens: {
        data: [{ user_id: 'user-1', expo_push_token: 'ExponentPushToken[a]' }],
        error: null,
      },
      users: {
        data: [{ id: 'user-1', display_name: 'Harbir', active_workout_split_id: null }],
        error: null,
      },
      notification_log: { data: [], error: null },
      food_logs: {
        data: [{ user_id: 'user-1', logged_at: new Date().toISOString() }],
        error: null,
      },
    });
    const expoPush = mockExpoPush();
    const service = new NotificationsService(supabaseService, expoPush);

    const result = await service.sendDailyNotifications();

    expect(result).toEqual({ workoutRemindersSent: 0, foodRemindersSent: 0 });
    expect(expoPush.sendAll).not.toHaveBeenCalled();
  });

  it('never sends the same reminder type twice in one day', async () => {
    const { supabaseService } = mockTables({
      device_push_tokens: {
        data: [{ user_id: 'user-1', expo_push_token: 'ExponentPushToken[a]' }],
        error: null,
      },
      users: {
        data: [{ id: 'user-1', display_name: 'Harbir', active_workout_split_id: 'split-1' }],
        error: null,
      },
      notification_log: {
        data: [
          { user_id: 'user-1', notification_type: 'next_workout' },
          { user_id: 'user-1', notification_type: 'food_log_reminder' },
        ],
        error: null,
      },
      food_logs: { data: [], error: null },
    });
    const expoPush = mockExpoPush();
    const service = new NotificationsService(supabaseService, expoPush);

    const result = await service.sendDailyNotifications();

    expect(result).toEqual({ workoutRemindersSent: 0, foodRemindersSent: 0 });
    expect(expoPush.sendAll).not.toHaveBeenCalled();
  });

  it('skips a user with an active split that has no days configured', async () => {
    const { supabaseService } = mockTables({
      device_push_tokens: {
        data: [{ user_id: 'user-1', expo_push_token: 'ExponentPushToken[a]' }],
        error: null,
      },
      users: {
        data: [{ id: 'user-1', display_name: 'Harbir', active_workout_split_id: 'split-1' }],
        error: null,
      },
      notification_log: { data: [], error: null },
      food_logs: {
        data: [{ user_id: 'user-1', logged_at: new Date().toISOString() }],
        error: null,
      },
      workout_split_days: { data: [], error: null },
      workouts: { data: null, error: null },
    });
    const expoPush = mockExpoPush();
    const service = new NotificationsService(supabaseService, expoPush);

    const result = await service.sendDailyNotifications();

    expect(result).toEqual({ workoutRemindersSent: 0, foodRemindersSent: 0 });
    expect(expoPush.sendAll).not.toHaveBeenCalled();
  });

  it('propagates a database error while loading push tokens', async () => {
    const { supabaseService } = mockTables({
      device_push_tokens: { data: null, error: { message: 'connection lost' } },
    });
    const service = new NotificationsService(supabaseService, mockExpoPush());

    await expect(service.sendDailyNotifications()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
