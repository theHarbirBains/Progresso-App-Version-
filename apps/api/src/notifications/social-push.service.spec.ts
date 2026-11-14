import type { SupabaseService } from '../supabase/supabase.service';
import type { ExpoPushProvider } from './providers/expo-push.provider';
import { SocialPushService } from './social-push.service';

function setup(user: Record<string, unknown> | null, tokens: string[]) {
  const results: Record<string, { data: unknown; error: null }> = {
    users: { data: user, error: null },
    device_push_tokens: { data: tokens.map((t) => ({ expo_push_token: t })), error: null },
  };
  const from = jest.fn((table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const b: any = {};
    b.select = jest.fn(() => b);
    b.eq = jest.fn(() => b);
    b.maybeSingle = jest.fn(async () => results[table]);
    b.then = (ok: (r: unknown) => unknown) => Promise.resolve(results[table]).then(ok);
    return b;
  });
  const sendAll = jest.fn().mockResolvedValue(undefined);
  const service = new SocialPushService(
    { getClient: () => ({ from }) } as unknown as SupabaseService,
    { sendAll } as unknown as ExpoPushProvider,
  );
  return { service, sendAll };
}

const push = { title: 'New like', body: 'Sam liked your workout.', path: 'workouts/w1' };

describe('SocialPushService', () => {
  it('pushes to every device, opening the screen it is about when tapped', async () => {
    const { service, sendAll } = setup({ push_notifications_opt_in: true, notify_likes: true }, [
      'ExponentPushToken[a]',
      'ExponentPushToken[b]',
    ]);

    await service.notify('user-1', 'likes', push);

    expect(sendAll).toHaveBeenCalledWith([
      {
        to: 'ExponentPushToken[a]',
        title: 'New like',
        body: 'Sam liked your workout.',
        data: { url: 'progresso://workouts/w1' },
      },
      {
        to: 'ExponentPushToken[b]',
        title: 'New like',
        body: 'Sam liked your workout.',
        data: { url: 'progresso://workouts/w1' },
      },
    ]);
  });

  it('sends nothing with that kind switched off, notifications declined, or no device', async () => {
    const off = setup({ push_notifications_opt_in: true, notify_likes: false }, ['t']);
    const declined = setup({ push_notifications_opt_in: false, notify_likes: true }, ['t']);
    const noDevice = setup({ push_notifications_opt_in: true, notify_likes: true }, []);

    await off.service.notify('user-1', 'likes', push);
    await declined.service.notify('user-1', 'likes', push);
    await noDevice.service.notify('user-1', 'likes', push);

    expect(off.sendAll).not.toHaveBeenCalled();
    expect(declined.sendAll).not.toHaveBeenCalled();
    expect(noDevice.sendAll).not.toHaveBeenCalled();
  });

  it('never fails what caused it', async () => {
    const { service, sendAll } = setup({ push_notifications_opt_in: true, notify_likes: true }, [
      't',
    ]);
    sendAll.mockRejectedValue(new Error('Expo is down'));

    await expect(service.notify('user-1', 'likes', push)).resolves.toBeUndefined();
  });
});
