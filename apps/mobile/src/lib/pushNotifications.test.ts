import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { requestPushToken } from './pushNotifications';

const mockGetPermissions = Notifications.getPermissionsAsync as jest.Mock;
const mockRequestPermissions = Notifications.requestPermissionsAsync as jest.Mock;
const mockGetExpoPushToken = Notifications.getExpoPushTokenAsync as jest.Mock;

beforeEach(() => {
  mockGetPermissions.mockReset().mockResolvedValue({ status: 'granted' });
  mockRequestPermissions.mockReset().mockResolvedValue({ status: 'granted' });
  mockGetExpoPushToken.mockReset().mockResolvedValue({ data: 'ExponentPushToken[test]' });
});

describe('requestPushToken', () => {
  it('returns null immediately on Android -- push is iOS-only for now, no prompt at all', async () => {
    Platform.OS = 'android';

    const token = await requestPushToken();

    expect(token).toBeNull();
    expect(mockGetPermissions).not.toHaveBeenCalled();
    Platform.OS = 'ios';
  });

  it('returns the Expo push token on iOS when permission is already granted', async () => {
    Platform.OS = 'ios';

    const token = await requestPushToken();

    expect(token).toBe('ExponentPushToken[test]');
    expect(mockRequestPermissions).not.toHaveBeenCalled();
  });

  it('prompts for permission when not yet determined, and returns the token once granted', async () => {
    Platform.OS = 'ios';
    mockGetPermissions.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissions.mockResolvedValue({ status: 'granted' });

    const token = await requestPushToken();

    expect(mockRequestPermissions).toHaveBeenCalled();
    expect(token).toBe('ExponentPushToken[test]');
  });

  it('returns null when permission is denied', async () => {
    Platform.OS = 'ios';
    mockGetPermissions.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissions.mockResolvedValue({ status: 'denied' });

    const token = await requestPushToken();

    expect(token).toBeNull();
    expect(mockGetExpoPushToken).not.toHaveBeenCalled();
  });
});
