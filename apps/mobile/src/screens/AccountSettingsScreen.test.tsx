import { fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { forgetAdminRoles } from '../feedback/useIsAdmin';
import { fetchMyRole } from '../lib/feedbackApi';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { AccountSettingsScreen } from './AccountSettingsScreen';

jest.mock('../auth/AuthProvider', () => ({ useAuth: jest.fn() }));
jest.mock('../lib/feedbackApi', () => ({ fetchMyRole: jest.fn() }));

const mockFetchMyRole = fetchMyRole as jest.Mock;

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: mockNavigate, goBack: mockGoBack };

beforeEach(() => {
  mockNavigate.mockClear();
  mockGoBack.mockClear();
  forgetAdminRoles();
  (useAuth as jest.Mock).mockReturnValue({
    user: { id: 'user-1' },
    session: { access_token: 'token-1' },
  });
  mockFetchMyRole.mockReset().mockResolvedValue('user');
});

function renderScreen() {
  return render(<AccountSettingsScreen navigation={navigation} route={{} as never} />);
}

describe('AccountSettingsScreen', () => {
  it('shows the Settings header and tagline', () => {
    renderScreen();

    expect(screen.getByText('Settings')).toBeTruthy();
    expect(screen.getByText('Customize your experience.')).toBeTruthy();
  });

  it('goes back when the header back button is pressed', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it.each([
    ['settings-category-personal-info', 'SettingsPersonalInfo'],
    ['settings-category-workout-preferences', 'SettingsWorkoutPreferences'],
    ['settings-category-nutrition', 'SettingsNutrition'],
    ['settings-category-notifications', 'SettingsNotifications'],
    ['settings-category-account-security', 'SettingsAccountSecurity'],
    ['settings-category-support', 'SettingsSupport'],
  ])('navigates to %s when its row is pressed', (testID, route) => {
    renderScreen();

    fireEvent.press(screen.getByTestId(testID));

    expect(mockNavigate).toHaveBeenCalledWith(route);
  });

  it('does not offer an "App" category -- every one of those destinations is already one tap away from the side menu', () => {
    renderScreen();

    expect(screen.queryByText(/^App$/)).toBeNull();
    expect(screen.queryByTestId('open-workouts')).toBeNull();
  });

  it('does not offer a Subscription category -- no purchase/subscription UI exists in the app yet', () => {
    renderScreen();

    expect(screen.queryByText(/Subscription/)).toBeNull();
  });

  it('renders no bare text outside <Text>', () => {
    renderScreen();
    expectNoBareText();
  });
});

describe("AccountSettingsScreen -- the admins' Feedback Inbox", () => {
  it('offers it to a support or full admin', async () => {
    for (const role of ['support_admin', 'full_admin']) {
      forgetAdminRoles();
      mockFetchMyRole.mockResolvedValue(role);
      const view = renderScreen();

      fireEvent.press(await screen.findByTestId('settings-admin-feedback-inbox'));

      expect(mockNavigate).toHaveBeenLastCalledWith('AdminFeedbackInbox');
      expect(mockFetchMyRole).toHaveBeenLastCalledWith('token-1');
      view.unmount();
    }
  });

  it('never offers it to anyone else, nor while their role is unknown', async () => {
    renderScreen();
    await screen.findByText('Settings');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByTestId('settings-admin-feedback-inbox')).toBeNull();
  });

  it("doesn't offer it when the role can't be read", async () => {
    mockFetchMyRole.mockRejectedValue(new Error('offline'));
    renderScreen();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByTestId('settings-admin-feedback-inbox')).toBeNull();
  });
});
