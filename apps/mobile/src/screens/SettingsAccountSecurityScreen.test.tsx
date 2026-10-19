import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Alert, StyleSheet } from 'react-native';
import { colors } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { deleteMyAccount } from '../lib/api';
import { supabase } from '../lib/supabase';
import { SettingsAccountSecurityScreen } from './SettingsAccountSecurityScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  deleteMyAccount: jest.fn(),
}));

jest.mock('../lib/supabase', () => ({
  supabase: { auth: { signOut: jest.fn() } },
}));

const mockDeleteMyAccount = deleteMyAccount as jest.Mock;
const mockLocalSignOut = supabase.auth.signOut as jest.Mock;

const mockUseAuth = useAuth as jest.Mock;
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: jest.fn(), goBack: mockGoBack };

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'athlete@example.com' },
    session: { access_token: 'token-1' },
    signOut: jest.fn(),
  });
  mockGoBack.mockClear();
  mockDeleteMyAccount.mockReset().mockResolvedValue({ success: true });
  mockLocalSignOut.mockReset().mockResolvedValue({ error: null });
  jest.restoreAllMocks();
});

/** Answers each alert by pressing the button with this text, if it has one. */
function answerAlerts(...labels: string[]) {
  return jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.find((b) => b.text !== undefined && labels.includes(b.text))?.onPress?.();
  });
}

function renderScreen() {
  return render(<SettingsAccountSecurityScreen navigation={navigation} route={{} as never} />);
}

describe('SettingsAccountSecurityScreen', () => {
  it('goes back when the header back button is pressed', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows the account email', () => {
    renderScreen();

    expect(screen.getByTestId('account-security-email')).toHaveTextContent('athlete@example.com');
  });

  it('shows Change Email as not-yet-available, next to the email it would change', () => {
    renderScreen();

    expect(screen.getByTestId('account-change-email')).toHaveTextContent(/Coming Soon/);
  });

  it('opens Change Password', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('account-change-password'));

    expect(navigation.navigate).toHaveBeenCalledWith('SettingsChangePassword');
  });

  it('opens the people you have blocked', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('account-blocked-people'));

    expect(navigation.navigate).toHaveBeenCalledWith('SettingsBlockedPeople');
  });

  it('calls signOut when the sign-out row is pressed', () => {
    const signOut = jest.fn();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1', email: 'athlete@example.com' }, signOut });
    renderScreen();

    fireEvent.press(screen.getByTestId('sign-out-button'));

    expect(signOut).toHaveBeenCalled();
  });

  it('deletes the account after asking twice, then signs out on this device', async () => {
    const alerts = answerAlerts('Continue', 'Delete Account');
    renderScreen();

    fireEvent.press(screen.getByTestId('account-delete-account'));

    await waitFor(() => expect(mockLocalSignOut).toHaveBeenCalledWith({ scope: 'local' }));
    expect(mockDeleteMyAccount).toHaveBeenCalledWith('token-1');
    expect(alerts.mock.calls.map((call) => call[0])).toEqual([
      'Delete your account?',
      'Are you sure?',
      'Account deleted',
    ]);
    expect(alerts.mock.calls[0][1]).toMatch(/claim their history for 30 days/);
  });

  it('deletes nothing when either question is cancelled', () => {
    answerAlerts('Continue');
    renderScreen();
    fireEvent.press(screen.getByTestId('account-delete-account'));
    expect(mockDeleteMyAccount).not.toHaveBeenCalled();

    jest.restoreAllMocks();
    answerAlerts();
    fireEvent.press(screen.getByTestId('account-delete-account'));
    expect(mockDeleteMyAccount).not.toHaveBeenCalled();
  });

  it('stays signed in and says so when deleting fails', async () => {
    mockDeleteMyAccount.mockRejectedValue(new Error('Could not delete your account'));
    const alerts = answerAlerts('Continue', 'Delete Account');
    renderScreen();

    fireEvent.press(screen.getByTestId('account-delete-account'));

    await waitFor(() =>
      expect(alerts).toHaveBeenCalledWith(
        "Couldn't delete your account",
        'Could not delete your account',
      ),
    );
    expect(mockLocalSignOut).not.toHaveBeenCalled();
    expect(screen.getByTestId('account-delete-account')).not.toHaveTextContent(/Deleting/);
  });

  it('shows Delete Account in the destructive colour, as a row, not a red button', () => {
    renderScreen();

    const title = within(screen.getByTestId('account-delete-account')).getByText('Delete Account');
    expect(StyleSheet.flatten(title.props.style).color).toBe(colors.destructive);
  });

  it('shows Terms of Service and Privacy Policy as real coming-soon rows, no invented content', () => {
    renderScreen();

    for (const testID of ['privacy-terms', 'privacy-policy']) {
      expect(screen.getByTestId(testID)).toHaveTextContent(/Coming Soon/);
    }
  });

  it('renders no bare text outside <Text>', () => {
    renderScreen();
    expectNoBareText();
  });
});
