import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { ProfileProvider } from '../profile/ProfileProvider';
import { fetchMyProfile } from '../profile/profileQueries';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { SettingsChangePasswordScreen } from './SettingsChangePasswordScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../profile/profileQueries', () => ({
  fetchMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockFetchMyProfile = fetchMyProfile as jest.Mock;
const mockSignInWithPassword = jest.fn();
const mockUpdatePassword = jest.fn();
const mockGoBack = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const navigation: any = { navigate: jest.fn(), goBack: mockGoBack };

function signedInWith(providers: string[]) {
  mockUseAuth.mockReturnValue({
    session: { access_token: 'token-123' },
    user: { id: 'user-1', email: 'athlete@example.com', app_metadata: { providers } },
    signInWithPassword: mockSignInWithPassword,
    updatePassword: mockUpdatePassword,
  });
}

beforeEach(() => {
  signedInWith(['email']);
  mockFetchMyProfile.mockReset().mockResolvedValue({ id: 'user-1', weightUnit: 'kg' });
  mockSignInWithPassword.mockReset().mockResolvedValue(null);
  mockUpdatePassword.mockReset().mockResolvedValue(null);
  mockGoBack.mockClear();
});

function renderScreen() {
  return render(
    <ProfileProvider>
      <SettingsChangePasswordScreen navigation={navigation} route={{} as never} />
    </ProfileProvider>,
  );
}

function fill(current: string, next: string, confirm: string) {
  fireEvent.changeText(screen.getByTestId('change-password-current'), current);
  fireEvent.changeText(screen.getByTestId('change-password-new'), next);
  fireEvent.changeText(screen.getByTestId('change-password-confirm'), confirm);
}

async function submit() {
  await act(async () => {
    fireEvent.press(screen.getByTestId('change-password-submit'));
  });
}

describe('SettingsChangePasswordScreen', () => {
  it('goes back when the header back button is pressed', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('app-header-back'));

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('keeps Update Password disabled until every field is filled and the new one is long enough', async () => {
    renderScreen();

    fill('old-secret', '12345', '12345');
    await submit();

    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(screen.getByTestId('change-password-submit')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ disabled: true }),
    );
  });

  it('stops at mismatched new passwords without touching the account', async () => {
    renderScreen();

    fill('old-secret', 'new-secret', 'new-secreT');
    await submit();

    expect(screen.getByTestId('change-password-error')).toHaveTextContent(
      'The new passwords do not match.',
    );
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('says so when the current password is wrong, and leaves the password unchanged', async () => {
    mockSignInWithPassword.mockResolvedValue('Invalid login credentials');
    renderScreen();

    fill('wrong-secret', 'new-secret', 'new-secret');
    await submit();

    expect(screen.getByTestId('change-password-error')).toHaveTextContent(
      'Your current password is incorrect.',
    );
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('checks the current password, then sets the new one and clears the form', async () => {
    renderScreen();

    fill('old-secret', 'new-secret', 'new-secret');
    await submit();

    expect(mockSignInWithPassword).toHaveBeenCalledWith('athlete@example.com', 'old-secret');
    expect(mockUpdatePassword).toHaveBeenCalledWith('new-secret');
    expect(mockSignInWithPassword.mock.invocationCallOrder[0]).toBeLessThan(
      mockUpdatePassword.mock.invocationCallOrder[0],
    );
    expect(screen.getByTestId('change-password-success')).toHaveTextContent(
      'Your password has been updated.',
    );
    expect(screen.getByTestId('change-password-current')).toHaveProp('value', '');
    expect(screen.queryByTestId('change-password-error')).toBeNull();
  });

  it('shows the error Supabase returns when the update itself fails', async () => {
    mockUpdatePassword.mockResolvedValue('New password should be different from the old password.');
    renderScreen();

    fill('old-secret', 'old-secret', 'old-secret');
    await submit();

    expect(screen.getByTestId('change-password-error')).toHaveTextContent(
      'New password should be different from the old password.',
    );
    expect(screen.queryByTestId('change-password-success')).toBeNull();
  });

  it('explains there is no password to change for an account that signs in with Google', () => {
    signedInWith(['google']);
    renderScreen();

    expect(screen.getByTestId('change-password-no-password')).toHaveTextContent(
      "You sign in with Google, so there's no Progresso password to change.",
    );
    expect(screen.queryByTestId('change-password-current')).toBeNull();
  });

  it('shows the form for an account with both a password and Apple sign-in', () => {
    signedInWith(['apple', 'email']);
    renderScreen();

    expect(screen.getByTestId('change-password-current')).toBeTruthy();
  });

  it('renders no bare text outside <Text>', () => {
    renderScreen();
    expectNoBareText();
  });
});
