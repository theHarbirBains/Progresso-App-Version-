import { act, render } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../auth/AuthProvider';
import {
  fetchUnreadNotificationCount,
  markNotificationsRead,
  registerPushToken,
  unregisterPushToken,
} from '../lib/notificationsApi';
import { forgetThisDevice } from '../lib/pushNotifications';
import { useProfileIfAny } from '../profile/profileContext';
import { notificationIdOf, PushSync } from './PushSync';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../profile/profileContext', () => ({ useProfileIfAny: jest.fn() }));
jest.mock('../lib/notificationsApi', () => ({
  registerPushToken: jest.fn(async () => ({ registered: true })),
  unregisterPushToken: jest.fn(async () => ({ removed: true })),
  markNotificationsRead: jest.fn(async () => ({ unread: 2 })),
  fetchUnreadNotificationCount: jest.fn(async () => ({ unread: 4 })),
}));

const NOTE = '44444444-4444-4444-8444-444444444444';

const tapped = (data: Record<string, unknown>) =>
  ({ notification: { request: { content: { data } } } }) as never;

function signedIn(optedIn = true) {
  (useAuth as jest.Mock).mockReturnValue({
    status: 'signedIn',
    user: { id: 'user-1' },
    session: { access_token: 'token-1' },
  });
  (useProfileIfAny as jest.Mock).mockReturnValue({ pushNotificationsOptIn: optedIn });
}

async function renderSync() {
  render(<PushSync />);
  await act(async () => {
    await new Promise((resolve) => setImmediate(resolve));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
  (Notifications.getLastNotificationResponse as jest.Mock).mockReturnValue(null);
});

describe('notificationIdOf', () => {
  it("reads the server's notification id from a tapped push, and nothing else", () => {
    expect(notificationIdOf(tapped({ notificationId: NOTE }))).toBe(NOTE);
    expect(notificationIdOf(tapped({ url: 'progresso://feed' }))).toBeNull();
    expect(notificationIdOf(tapped({ notificationId: 'not-an-id' }))).toBeNull();
    expect(notificationIdOf(null)).toBeNull();
  });
});

describe('PushSync', () => {
  it('registers this device for them as the app opens -- never asking -- and sets the badge', async () => {
    signedIn();
    await renderSync();

    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(registerPushToken).toHaveBeenCalledWith('token-1', 'ExponentPushToken[test]', 'ios');
    expect(fetchUnreadNotificationCount).toHaveBeenCalledWith('token-1');
    expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(4);
  });

  it('registers nothing for someone who said no to notifications, or a phone that refuses them', async () => {
    signedIn(false);
    await renderSync();
    expect(registerPushToken).not.toHaveBeenCalled();

    signedIn(true);
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    await renderSync();
    expect(registerPushToken).not.toHaveBeenCalled();
  });

  it('registers a token iOS replaces', async () => {
    signedIn();
    await renderSync();
    const listener = (Notifications.addPushTokenListener as jest.Mock).mock.calls[0][0];
    await act(async () => {
      listener({ type: 'ios', data: 'ExponentPushToken[new]' });
    });
    expect(registerPushToken).toHaveBeenCalledWith('token-1', 'ExponentPushToken[new]', 'ios');
  });

  it('marks a tapped notification read -- one that opened the app too -- once', async () => {
    signedIn();
    (Notifications.getLastNotificationResponse as jest.Mock).mockReturnValue(
      tapped({ notificationId: NOTE }),
    );
    await renderSync();
    expect(markNotificationsRead).toHaveBeenCalledWith('token-1', [NOTE]);

    const listener = (Notifications.addNotificationResponseReceivedListener as jest.Mock).mock
      .calls[0][0];
    await act(async () => {
      listener(tapped({ notificationId: NOTE }));
    });
    expect(markNotificationsRead).toHaveBeenCalledTimes(1);
  });
});

describe('forgetThisDevice', () => {
  it("removes this device's token and clears the badge as they sign out", async () => {
    await forgetThisDevice('token-1');
    expect(unregisterPushToken).toHaveBeenCalledWith('token-1', 'ExponentPushToken[test]');
    expect(Notifications.setBadgeCountAsync).toHaveBeenCalledWith(0);
  });

  it('never stops a sign-out', async () => {
    (unregisterPushToken as jest.Mock).mockRejectedValueOnce(new Error('offline'));
    await expect(forgetThisDevice('token-1')).resolves.toBeUndefined();
    await expect(forgetThisDevice(null)).resolves.toBeUndefined();
  });
});
