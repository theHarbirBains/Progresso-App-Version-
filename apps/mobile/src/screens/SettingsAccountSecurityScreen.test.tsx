import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Alert, StyleSheet } from 'react-native';
import { colors } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { useAuth } from '../auth/AuthProvider';
import { SettingsAccountSecurityScreen } from './SettingsAccountSecurityScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: jest.fn(), goBack: mockGoBack };

beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: 'user-1', email: 'athlete@example.com' },
    signOut: jest.fn(),
  });
  mockGoBack.mockClear();
});

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

  it('shows Change Password as not yet available rather than performing a fake action', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderScreen();

    fireEvent.press(screen.getByTestId('account-change-password'));

    expect(alertSpy).toHaveBeenCalledWith('Change Password', expect.any(String));
    alertSpy.mockRestore();
  });

  it('calls signOut when the sign-out row is pressed', () => {
    const signOut = jest.fn();
    mockUseAuth.mockReturnValue({ user: { id: 'user-1', email: 'athlete@example.com' }, signOut });
    renderScreen();

    fireEvent.press(screen.getByTestId('sign-out-button'));

    expect(signOut).toHaveBeenCalled();
  });

  it('shows Delete Account as destructive and not yet available rather than deleting anything', () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    renderScreen();

    fireEvent.press(screen.getByTestId('account-delete-account'));

    expect(alertSpy).toHaveBeenCalledWith('Delete Account', expect.any(String));
    alertSpy.mockRestore();
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
