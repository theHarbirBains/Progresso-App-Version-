import { fireEvent, render, screen } from '@testing-library/react-native';
import { Alert, StyleSheet } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { getMyProfile, updateMyProfile } from '../lib/api';
import { DEFAULT_NUTRITION_COLOR, DEFAULT_WORKOUT_COLOR } from '../theme/accentColor';
import { AccountSettingsScreen } from './AccountSettingsScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGetMyProfile = getMyProfile as jest.Mock;
const mockUpdateMyProfile = updateMyProfile as jest.Mock;

const baseProfile = {
  id: 'user-1',
  email: 'athlete@example.com',
  role: 'user',
  displayName: 'Athlete',
  username: 'athlete1',
  weightUnit: 'kg' as const,
  workoutAccentColor: null as string | null,
  nutritionAccentColor: null as string | null,
  pushNotificationsOptIn: null as boolean | null,
  emailOptIn: null as boolean | null,
};

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  addListener: jest.fn((event: string, cb: () => void) => {
    if (event === 'focus') cb();
    return jest.fn();
  }),
};

function goToCategory(category: string) {
  fireEvent.press(screen.getByTestId(`settings-tabs-${category}`));
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'athlete@example.com' },
    session: { access_token: 'token-123' },
    signOut: jest.fn(),
  });
  mockGetMyProfile.mockReset().mockResolvedValue(baseProfile);
  mockUpdateMyProfile.mockReset();
  mockNavigate.mockClear();
  mockGoBack.mockClear();
});

describe('AccountSettingsScreen shell', () => {
  it('shows the Settings header and tagline', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('account-email')).toBeTruthy();
    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Customize your experience.')).toBeTruthy();
  });

  it('goes back when the header back button is pressed', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('defaults to the Account category', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('account-email')).toBeTruthy();
  });

  it('switches categories without losing the tab bar', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    goToCategory('Appearance');
    expect(screen.getByTestId('open-workout-color-settings')).toBeTruthy();
    expect(screen.queryByTestId('account-email')).toBeNull();

    goToCategory('Account');
    expect(screen.getByTestId('account-email')).toBeTruthy();
  });

  it('shows a load error without crashing the rest of the shell', async () => {
    mockGetMyProfile.mockRejectedValue(new Error('Failed to load profile'));

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('account-load-error')).toHaveTextContent(
      'Failed to load profile',
    );
    expect(screen.getByTestId('settings-tabs')).toBeTruthy();
  });

  it('lists all six categories, horizontally scrollable', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    for (const category of ['Account', 'Appearance', 'App', 'Notifications', 'Privacy', 'Help']) {
      expect(screen.getByTestId(`settings-tabs-${category}`)).toBeTruthy();
    }
  });

  // Regression coverage: on a category with little content below (e.g.
  // Appearance/Notifications), the content ScrollView previously had no
  // explicit flex: 1, so it and the tabs' own ScrollView both fell back to
  // React Native's default flexGrow: 1 and split the leftover vertical
  // space -- stretching the tab pills into tall ovals. The content
  // ScrollView must always claim the remaining space, on every category,
  // never the tabs bar.
  it('keeps the content area (not the tab bar) flexible on every category, even short ones', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    for (const category of ['Appearance', 'App', 'Notifications', 'Privacy', 'Help']) {
      goToCategory(category);

      const contentStyle = StyleSheet.flatten(
        screen.getByTestId('settings-scroll').props.style,
      ) as Record<string, unknown>;
      expect(contentStyle.flex).toBe(1);
    }
  });
});

describe('AccountSettingsScreen Account category', () => {
  it('loads and displays the profile', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);

    expect(await screen.findByTestId('account-email')).toHaveTextContent('athlete@example.com');
    expect(screen.getByTestId('account-display-name').props.value).toBe('Athlete');
    expect(screen.getByTestId('account-username').props.value).toBe('athlete1');
    expect(mockGetMyProfile).toHaveBeenCalledWith('token-123');
  });

  it("colors Save Changes with the user's own Workout accent, not the static brand color", async () => {
    mockGetMyProfile.mockResolvedValue({ ...baseProfile, workoutAccentColor: '#EF4444' });

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    const style = StyleSheet.flatten(screen.getByTestId('account-save').props.style);
    expect(style.backgroundColor).toBe('#EF4444');
  });

  it('lowercases username input as the user types', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.changeText(screen.getByTestId('account-username'), 'NewHandle');

    expect(screen.getByTestId('account-username').props.value).toBe('newhandle');
  });

  it('saves the profile and shows a confirmation', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, displayName: 'New Name' });

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.changeText(screen.getByTestId('account-display-name'), 'New Name');
    fireEvent.press(screen.getByTestId('account-unit-lb'));
    fireEvent.press(screen.getByTestId('account-save'));

    expect(await screen.findByTestId('account-saved')).toBeTruthy();
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      displayName: 'New Name',
      username: 'athlete1',
      weightUnit: 'lb',
    });
  });

  it('shows a save error and does not show the saved confirmation on failure', async () => {
    mockUpdateMyProfile.mockRejectedValue(new Error('Username is already taken'));

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.press(screen.getByTestId('account-save'));

    expect(await screen.findByTestId('account-save-error')).toHaveTextContent(
      'Username is already taken',
    );
    expect(screen.queryByTestId('account-saved')).toBeNull();
  });

  it('calls signOut when the sign-out row is pressed', async () => {
    const signOut = jest.fn();
    mockUseAuth.mockReturnValue({
      user: { id: 'user-1', email: 'athlete@example.com' },
      session: { access_token: 'token-123' },
      signOut,
    });

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.press(screen.getByTestId('sign-out-button'));

    expect(signOut).toHaveBeenCalled();
  });

  it('shows Change Password as not yet available rather than performing a fake action', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.press(screen.getByTestId('account-change-password'));

    expect(alertSpy).toHaveBeenCalledWith('Change Password', expect.any(String));
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('shows Delete Account as destructive and not yet available rather than deleting anything', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');

    fireEvent.press(screen.getByTestId('account-delete-account'));

    expect(alertSpy).toHaveBeenCalledWith('Delete Account', expect.any(String));
    alertSpy.mockRestore();
  });
});

describe('AccountSettingsScreen Appearance category', () => {
  it('shows the default colors and preset names when the user has not customized either mode', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Appearance');

    expect(screen.getByTestId('open-workout-color-settings')).toHaveTextContent(/Electric Blue/);
    expect(screen.getByTestId('open-nutrition-color-settings')).toHaveTextContent(/Emerald/);
  });

  it("shows 'Custom' when the saved color doesn't match any preset", async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      workoutAccentColor: '#123456',
      nutritionAccentColor: '#654321',
    });

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Appearance');

    expect(screen.getByTestId('open-workout-color-settings')).toHaveTextContent(/Custom/);
    expect(screen.getByTestId('open-nutrition-color-settings')).toHaveTextContent(/Custom/);
  });

  it('navigates to WorkoutColorSettings when the Workout Mode row is pressed', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Appearance');

    fireEvent.press(screen.getByTestId('open-workout-color-settings'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutColorSettings');
  });

  it('navigates to NutritionColorSettings when the Nutrition Mode row is pressed', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Appearance');

    fireEvent.press(screen.getByTestId('open-nutrition-color-settings'));

    expect(mockNavigate).toHaveBeenCalledWith('NutritionColorSettings');
  });

  it('asks for confirmation before resetting, and does nothing if cancelled', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      workoutAccentColor: '#EF4444',
      nutritionAccentColor: '#8B5CF6',
    });

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Appearance');

    fireEvent.press(screen.getByTestId('reset-theme-colors'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Reset Theme Colors',
      expect.any(String),
      expect.any(Array),
    );
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it('resets both colors to the defaults when the confirmation is accepted', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      workoutAccentColor: '#EF4444',
      nutritionAccentColor: '#8B5CF6',
    });
    mockUpdateMyProfile.mockResolvedValue({
      ...baseProfile,
      workoutAccentColor: DEFAULT_WORKOUT_COLOR,
      nutritionAccentColor: DEFAULT_NUTRITION_COLOR,
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
      const resetButton = buttons?.find((b) => b.text === 'Reset');
      resetButton?.onPress?.();
    });

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Appearance');

    fireEvent.press(screen.getByTestId('reset-theme-colors'));

    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      workoutAccentColor: DEFAULT_WORKOUT_COLOR,
      nutritionAccentColor: DEFAULT_NUTRITION_COLOR,
    });
    expect(await screen.findByTestId('open-workout-color-settings')).toHaveTextContent(
      /Electric Blue/,
    );
    expect(screen.getByTestId('open-nutrition-color-settings')).toHaveTextContent(/Emerald/);
    alertSpy.mockRestore();
  });
});

describe('AccountSettingsScreen App category', () => {
  it('navigates to Workout History when its row is pressed', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('App');

    fireEvent.press(screen.getByTestId('open-workouts'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutHistory');
  });

  it('navigates to Workout Splits when its row is pressed', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('App');

    fireEvent.press(screen.getByTestId('open-workout-splits'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutSplits');
  });

  it('navigates to the Exercise Library when its row is pressed', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('App');

    fireEvent.press(screen.getByTestId('open-exercise-library'));

    expect(mockNavigate).toHaveBeenCalledWith('ExerciseLibrary');
  });

  it('navigates to Nutrition when its row is pressed', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('App');

    fireEvent.press(screen.getByTestId('open-nutrition'));

    expect(mockNavigate).toHaveBeenCalledWith('Nutrition');
  });
});

describe('AccountSettingsScreen Notifications category', () => {
  it('reflects the real saved push/email preferences', async () => {
    mockGetMyProfile.mockResolvedValue({
      ...baseProfile,
      pushNotificationsOptIn: true,
      emailOptIn: false,
    });

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Notifications');

    expect(screen.getByTestId('notif-push-toggle').props.value).toBe(true);
    expect(screen.getByTestId('notif-email-toggle').props.value).toBe(false);
  });

  it('persists a push-notification toggle immediately via the existing profile API', async () => {
    mockUpdateMyProfile.mockResolvedValue({ ...baseProfile, pushNotificationsOptIn: true });

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Notifications');

    fireEvent(screen.getByTestId('notif-push-toggle'), 'valueChange', true);

    expect(await screen.findByTestId('notif-push-toggle')).toHaveProp('value', true);
    expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-123', {
      pushNotificationsOptIn: true,
    });
  });

  it('reverts the toggle if saving the preference fails', async () => {
    mockUpdateMyProfile.mockRejectedValue(new Error('network down'));

    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Notifications');

    fireEvent(screen.getByTestId('notif-email-toggle'), 'valueChange', true);

    expect(await screen.findByTestId('notif-email-toggle')).toHaveProp('value', false);
  });

  it('shows the granular notification categories as real Coming Soon rows, not fake toggles', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Notifications');

    expect(screen.getByTestId('notif-workout-reminders')).toHaveTextContent(/Coming Soon/);
    expect(screen.getByTestId('notif-pr-notifications')).toHaveTextContent(/Coming Soon/);
    expect(screen.getByTestId('notif-weekly-summary')).toHaveTextContent(/Coming Soon/);
    expect(screen.getByTestId('notif-social-notifications')).toHaveTextContent(/Coming Soon/);
  });
});

describe('AccountSettingsScreen Privacy category', () => {
  it('shows a real coming-soon state, no invented privacy controls', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Privacy');

    expect(screen.getByTestId('settings-privacy-empty')).toHaveTextContent(/coming soon/i);
  });
});

describe('AccountSettingsScreen Help category', () => {
  it('shows every help row as Coming Soon rather than a fabricated link', async () => {
    render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
    await screen.findByTestId('account-email');
    goToCategory('Help');

    for (const testID of [
      'help-faq',
      'help-contact-support',
      'help-report-problem',
      'help-about',
      'help-terms',
      'help-privacy-policy',
    ]) {
      expect(screen.getByTestId(testID)).toHaveTextContent(/Coming Soon/);
    }
  });
});
