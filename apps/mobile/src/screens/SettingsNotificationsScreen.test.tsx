import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { registerPushToken, unregisterPushToken, updateMyProfile } from '../lib/api';
import { ProfileProvider } from '../profile/ProfileProvider';
import { SettingsNotificationsScreen } from './SettingsNotificationsScreen';
import { fetchMyProfile } from '../profile/profileQueries';
import { MembershipContext } from '../membership/useMembership';
import { RemindersContext, type RemindersContextValue } from '../notifications/remindersContext';
import { defaultReminderSettings } from '../notifications/reminderSettings';

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

const mockUpdateReminders = jest.fn();
const mockRefreshAllowed = jest.fn(async () => undefined);

function reminders(overrides: Partial<RemindersContextValue> = {}): RemindersContextValue {
  return {
    settings: defaultReminderSettings(),
    update: mockUpdateReminders,
    allowed: true,
    refreshAllowed: mockRefreshAllowed,
    active: true,
    ...overrides,
  };
}

function renderScreen(
  remindersValue: RemindersContextValue = reminders(),
  tier: 'workouts' | 'workouts_nutrition' | 'everything' = 'everything',
) {
  return render(
    <ProfileProvider>
      <MembershipContext.Provider value={tier}>
        <RemindersContext.Provider value={remindersValue}>
          <SettingsNotificationsScreen navigation={navigation} route={{} as never} />
        </RemindersContext.Provider>
      </MembershipContext.Provider>
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

  it('switches each kind of social push on and off: follow requests, likes, comments', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, notifyLikes: false });
    renderScreen();
    await screen.findByTestId('notif-push-toggle');

    expect(screen.getByTestId('notif-social-follows-toggle').props.value).toBe(true);
    expect(screen.getByTestId('notif-social-comments-toggle').props.value).toBe(true);
    fireEvent(screen.getByTestId('notif-social-likes-toggle'), 'valueChange', false);

    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(expect.any(String), { notifyLikes: false }),
    );
    expect(screen.getByTestId('notif-social-likes-toggle').props.value).toBe(false);

    // Live workout invites, the same way.
    expect(screen.getByTestId('notif-social-group-invites-toggle').props.value).toBe(true);
    fireEvent(screen.getByTestId('notif-social-group-invites-toggle'), 'valueChange', false);
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(expect.any(String), {
        notifyGroupInvites: false,
      }),
    );

    // Accepted requests have a switch of their own.
    expect(screen.getByTestId('notif-social-follow-accepted-toggle').props.value).toBe(true);
    fireEvent(screen.getByTestId('notif-social-follow-accepted-toggle'), 'valueChange', false);
    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith(expect.any(String), {
        notifyFollowAccepted: false,
      }),
    );
  });

  it('asks the phone again once push is turned on, so the reminders can start', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, pushNotificationsOptIn: true });
    renderScreen();
    await screen.findByTestId('notif-push-toggle');

    fireEvent(screen.getByTestId('notif-push-toggle'), 'valueChange', true);

    await waitFor(() => expect(mockRefreshAllowed).toHaveBeenCalled());
  });

  it('renders no bare text outside <Text>', async () => {
    renderScreen();
    await screen.findByTestId('notif-push-toggle');
    expectNoBareText();
  });
});

describe('SettingsNotificationsScreen -- reminders', () => {
  beforeEach(() => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, pushNotificationsOptIn: true });
    mockUpdateReminders.mockClear();
  });

  it('shows each reminder with its toggle and time -- training nudges with neither days nor a time', async () => {
    renderScreen();
    await screen.findByTestId('notif-workout-toggle');

    expect(screen.getByTestId('notif-workout')).toHaveTextContent(/Training Nudges/);
    expect(screen.getByTestId('notif-workout-toggle')).toHaveProp('value', true);
    expect(screen.queryByTestId('notif-workout-time')).toBeNull();
    expect(screen.queryByTestId('notif-workout-days')).toBeNull();
    expect(screen.queryByText('Workout Days')).toBeNull();
    expect(screen.getByTestId('notif-prCheers-toggle')).toHaveProp('value', true);
    // The weekly summary as Sunday starts.
    expect(screen.getByTestId('notif-weekly-time')).toHaveTextContent(/12:00 AM/);
    expect(screen.getByTestId('notif-meals-time')).toHaveTextContent(/12:30 PM/);
    expect(screen.getByTestId('notif-checkIn-time')).toHaveTextContent(/8:00 PM/);
    expectNoBareText();
  });

  it('turns a reminder off, and drops its time with it', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('notif-push-toggle')).toHaveProp('value', true));

    fireEvent(screen.getByTestId('notif-meals-toggle'), 'valueChange', false);

    expect(mockUpdateReminders).toHaveBeenCalledWith(
      expect.objectContaining({ meals: { on: false, time: 12 * 60 + 30 } }),
    );
  });

  it('turns training nudges off', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('notif-push-toggle')).toHaveProp('value', true));

    fireEvent(screen.getByTestId('notif-workout-toggle'), 'valueChange', false);

    expect(mockUpdateReminders).toHaveBeenCalledWith(
      expect.objectContaining({ workout: { on: false } }),
    );
  });

  it("chooses a reminder's time on the wheels", async () => {
    renderScreen();
    // Once the saved push choice is in: until then the reminders are held off.
    await waitFor(() => expect(screen.getByTestId('notif-push-toggle')).toHaveProp('value', true));
    fireEvent.press(screen.getByTestId('notif-checkIn-time'));

    fireEvent.press(screen.getByTestId('reminder-time-hour-item-9'));
    fireEvent.press(screen.getByTestId('reminder-time-minute-item-30'));
    expect(screen.getByTestId('reminder-time-preview')).toHaveTextContent('9:30 PM');
    fireEvent.press(screen.getByTestId('reminder-time-done'));

    expect(mockUpdateReminders).toHaveBeenCalledWith(
      expect.objectContaining({ checkIn: { on: true, time: 21 * 60 + 30 } }),
    );
  });

  it('has no nutrition reminders without Nutrition in the membership', async () => {
    renderScreen(reminders(), 'workouts');
    await screen.findByTestId('notif-workout-toggle');

    expect(screen.queryByTestId('notif-meals')).toBeNull();
    expect(screen.queryByTestId('notif-checkIn')).toBeNull();
    expect(screen.getByTestId('notif-prCheers')).toBeTruthy();
  });

  it('says reminders need Push Notifications, and holds them off, until it is on', async () => {
    mockFetchMyProfile.mockResolvedValue({ ...baseProfile, pushNotificationsOptIn: false });
    renderScreen(reminders({ active: false }));
    await screen.findByTestId('notif-workout-toggle');

    expect(screen.getByTestId('notif-reminders-need-push')).toBeTruthy();
    expect(screen.getByTestId('notif-workout-toggle')).toHaveProp('disabled', true);
  });

  it("says when the phone doesn't allow notifications, with a way to its Settings", async () => {
    renderScreen(reminders({ allowed: false, active: false }));

    expect(await screen.findByTestId('notif-reminders-blocked')).toHaveTextContent(
      /turned off for Progresso/,
    );
    expect(screen.getByTestId('notif-open-settings')).toBeTruthy();
    expect(screen.getByTestId('notif-workout-toggle')).toHaveProp('disabled', true);
  });
});
