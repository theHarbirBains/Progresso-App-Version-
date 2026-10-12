import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { registerPushToken, unregisterPushToken, updateMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { SettingsNotificationsScreen } from './SettingsNotificationsScreen';
import { fetchMyProfile } from '../profile/profileQueries';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
  registerPushToken: jest.fn(),
  unregisterPushToken: jest.fn(),
}));

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockRegisterPushToken = registerPushToken as jest.Mock;
const mockUnregisterPushToken = unregisterPushToken as jest.Mock;

const baseProfile = {
  id: 'user-1',
  email: 'athlete@example.com',
  role: 'user',
  pushNotificationsOptIn: null as boolean | null,
  emailOptIn: null as boolean | null,
};

const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: jest.fn(), goBack: mockGoBack };

beforeEach(() => {
  mockUseAuth.mockReturnValue({ session: { access_token: 'token-123' }, user: { id: 'user-1' } });
  mockFetchMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset();
  mockRegisterPushToken.mockReset().mockResolvedValue({ registered: true });
  mockUnregisterPushToken.mockReset().mockResolvedValue({ removed: true });
  mockGoBack.mockClear();
});

function renderScreen() {
  return render(
    <ProfileProvider>
      <SettingsNotificationsScreen navigation={navigation} route={{} as never} />
    </ProfileProvider>,
  );
}

describe('SettingsNotificationsScreen', () => {
  it('goes back when the header back button is pressed', async () => {
    renderScreen();
    await screen.findByTestId('notif-push-toggle');

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('reflects the real saved push/email preferences', async () => {
    mockFetchMyProfile.mockResolvedValue({
      ...baseProfile,
      pushNotificationsOptIn: true,
      emailOptIn: false,
    });
    renderScreen();

    expect(await screen.findByTestId('notif-push-toggle')).toHaveProp('value', true);
    expect(screen.getByTestId('notif-email-toggle')).toHaveProp('value', false);
  });

  it('persists a push-notification toggle immediately via the existing profile API', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, pushNotificationsOptIn: true });
    renderScreen();
    await screen.findByTestId('notif-push-toggle');

    fireEvent(screen.getByTestId('notif-push-toggle'), 'valueChange', true);

    expect(await screen.findByTestId('notif-push-toggle')).toHaveProp('value', true);
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      pushNotificationsOptIn: true,
    });
  });

  it('registers this device for real push delivery when push is turned on', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, pushNotificationsOptIn: true });
    renderScreen();
    await screen.findByTestId('notif-push-toggle');

    fireEvent(screen.getByTestId('notif-push-toggle'), 'valueChange', true);

    await waitFor(() =>
      expect(mockRegisterPushToken).toHaveBeenCalledWith(
        'token-123',
        'ExponentPushToken[test]',
        'ios',
      ),
    );
    expect(mockUnregisterPushToken).not.toHaveBeenCalled();
  });

  it('unregisters this device when push is turned back off', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, pushNotificationsOptIn: false });
    renderScreen();
    await screen.findByTestId('notif-push-toggle');

    fireEvent(screen.getByTestId('notif-push-toggle'), 'valueChange', false);

    await waitFor(() =>
      expect(mockUnregisterPushToken).toHaveBeenCalledWith('token-123', 'ExponentPushToken[test]'),
    );
    expect(mockRegisterPushToken).not.toHaveBeenCalled();
  });

  it('still saves the preference even when permission is denied (no token to register)', async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({ status: 'denied' });
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, pushNotificationsOptIn: true });
    renderScreen();
    await screen.findByTestId('notif-push-toggle');

    fireEvent(screen.getByTestId('notif-push-toggle'), 'valueChange', true);

    expect(await screen.findByTestId('notif-push-toggle')).toHaveProp('value', true);
    expect(mockRegisterPushToken).not.toHaveBeenCalled();
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      pushNotificationsOptIn: true,
    });
  });

  it('reverts the toggle if saving the preference fails', async () => {
    mockUpdateMyProfile.mockRejectedValue(new Error('network down'));
    renderScreen();
    await screen.findByTestId('notif-push-toggle');

    fireEvent(screen.getByTestId('notif-email-toggle'), 'valueChange', true);

    expect(await screen.findByTestId('notif-email-toggle')).toHaveProp('value', false);
  });

  it('shows the granular notification categories as real Coming Soon rows, not fake toggles', async () => {
    renderScreen();
    await screen.findByTestId('notif-push-toggle');

    expect(screen.getByTestId('notif-workout-reminders')).toHaveTextContent(/Coming Soon/);
    expect(screen.getByTestId('notif-pr-notifications')).toHaveTextContent(/Coming Soon/);
    expect(screen.getByTestId('notif-weekly-summary')).toHaveTextContent(/Coming Soon/);
    expect(screen.getByTestId('notif-social-notifications')).toHaveTextContent(/Coming Soon/);
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('notif-push-toggle');
    expectNoBareText();
  });
});
