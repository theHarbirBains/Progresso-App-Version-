import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { updateMyProfile } from '../lib/api';
import { SignUpScreen } from './SignUpScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('../lib/api', () => ({
  updateMyProfile: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockSignUpWithPassword = jest.fn();
const mockUpdateMyProfile = updateMyProfile as jest.Mock;
const mockOnSwitchToSignIn = jest.fn();

beforeEach(() => {
  mockUseAuth.mockReturnValue({ signUpWithPassword: mockSignUpWithPassword });
  mockSignUpWithPassword
    .mockReset()
    .mockResolvedValue({ error: null, requiresEmailConfirmation: true, accessToken: null });
  mockUpdateMyProfile.mockReset().mockResolvedValue({});
  mockOnSwitchToSignIn.mockClear();
});

/** Fills every field required for canSubmit to become true, so a test can go straight to pressing submit. */
function fillValidForm(overrides: Partial<Record<string, string>> = {}) {
  fireEvent.changeText(screen.getByTestId('sign-up-first-name'), overrides.firstName ?? 'Harbir');
  fireEvent.changeText(screen.getByTestId('sign-up-last-name'), overrides.lastName ?? 'Bains');
  fireEvent.changeText(
    screen.getByTestId('sign-up-display-name'),
    overrides.displayName ?? 'Harbir B',
  );
  fireEvent.changeText(screen.getByTestId('sign-up-username'), overrides.username ?? 'harbirb');
  fireEvent.changeText(screen.getByTestId('sign-up-email'), overrides.email ?? 'new@example.com');
  fireEvent.changeText(screen.getByTestId('sign-up-password'), overrides.password ?? 'password123');
  fireEvent.changeText(
    screen.getByTestId('sign-up-confirm-password'),
    overrides.confirmPassword ?? overrides.password ?? 'password123',
  );
}

describe('SignUpScreen', () => {
  it('renders the logo, headline, and all fields', () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    expect(screen.getByText('Create your account')).toBeTruthy();
    expect(screen.getByText('Start tracking your progress.')).toBeTruthy();
    expect(screen.getByTestId('sign-up-first-name')).toBeTruthy();
    expect(screen.getByTestId('sign-up-last-name')).toBeTruthy();
    expect(screen.getByTestId('sign-up-display-name')).toBeTruthy();
    expect(screen.getByTestId('sign-up-username')).toBeTruthy();
    expect(screen.getByTestId('sign-up-email')).toBeTruthy();
    expect(screen.getByTestId('sign-up-password')).toBeTruthy();
    expect(screen.getByTestId('sign-up-confirm-password')).toBeTruthy();
  });

  it('disables submit until every field is present and valid', () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    expect(screen.getByTestId('sign-up-submit').props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('sign-up-first-name'), 'Harbir');
    fireEvent.changeText(screen.getByTestId('sign-up-last-name'), 'Bains');
    fireEvent.changeText(screen.getByTestId('sign-up-display-name'), 'Harbir B');
    fireEvent.changeText(screen.getByTestId('sign-up-username'), 'harbirb');
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    expect(screen.getByTestId('sign-up-submit').props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    expect(screen.getByTestId('sign-up-submit').props.accessibilityState?.disabled).toBe(false);
  });

  it('keeps submit disabled while the username fails the format rule', () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    fireEvent.changeText(screen.getByTestId('sign-up-first-name'), 'Harbir');
    fireEvent.changeText(screen.getByTestId('sign-up-last-name'), 'Bains');
    fireEvent.changeText(screen.getByTestId('sign-up-display-name'), 'Harbir B');
    fireEvent.changeText(screen.getByTestId('sign-up-username'), 'ab'); // too short
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');

    expect(screen.getByTestId('sign-up-submit').props.accessibilityState?.disabled).toBe(true);
  });

  it('lowercases username input as the user types', () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    fireEvent.changeText(screen.getByTestId('sign-up-username'), 'HarbirB');

    expect(screen.getByTestId('sign-up-username').props.value).toBe('harbirb');
  });

  it('shows an inline error when the passwords do not match, and blocks submit', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    fillValidForm({ confirmPassword: 'different' });

    expect(screen.getByTestId('sign-up-password-mismatch')).toHaveTextContent(
      "Passwords don't match",
    );
    expect(screen.getByTestId('sign-up-submit').props.accessibilityState?.disabled).toBe(true);

    fireEvent.press(screen.getByTestId('sign-up-submit'));
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();
  });

  it('does not show a mismatch error before the confirm field has been touched', () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');

    expect(screen.queryByTestId('sign-up-password-mismatch')).toBeNull();
  });

  it('requires at least 6 characters for the password', () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    fillValidForm({ password: 'short', confirmPassword: 'short' });

    expect(screen.getByTestId('sign-up-submit').props.accessibilityState?.disabled).toBe(true);
  });

  it('toggles password visibility independently for each field', () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    expect(screen.getByTestId('sign-up-password').props.secureTextEntry).toBe(true);
    expect(screen.getByTestId('sign-up-confirm-password').props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByTestId('sign-up-password-toggle'));
    expect(screen.getByTestId('sign-up-password').props.secureTextEntry).toBe(false);
    expect(screen.getByTestId('sign-up-confirm-password').props.secureTextEntry).toBe(true);

    fireEvent.press(screen.getByTestId('sign-up-confirm-password-toggle'));
    expect(screen.getByTestId('sign-up-confirm-password').props.secureTextEntry).toBe(false);
  });

  it('submits only email and password to signUpWithPassword -- confirm password is never sent', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    fillValidForm({ email: '  new@example.com  ' });
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    await waitFor(() =>
      expect(mockSignUpWithPassword).toHaveBeenCalledWith('new@example.com', 'password123'),
    );
  });

  it('shows a loading label and disables the button while submitting', async () => {
    let resolveSignUp: (value: {
      error: null;
      requiresEmailConfirmation: boolean;
      accessToken: string | null;
    }) => void = () => {};
    mockSignUpWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveSignUp = resolve;
      }),
    );

    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    expect(await screen.findByText('Creating Account...')).toBeTruthy();
    expect(screen.getByTestId('sign-up-submit').props.accessibilityState?.disabled).toBe(true);

    resolveSignUp({ error: null, requiresEmailConfirmation: true, accessToken: null });
    expect(await screen.findByTestId('sign-up-confirmation')).toBeTruthy();
  });

  it('shows a human-readable server error without crashing the form', async () => {
    mockSignUpWithPassword.mockResolvedValue({
      error: 'An account with this email already exists',
      requiresEmailConfirmation: false,
      accessToken: null,
    });

    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent(
      'An account with this email already exists',
    );
    expect(screen.queryByTestId('sign-up-confirmation')).toBeNull();
  });

  it('shows the confirmation screen after a successful signup requiring email confirmation', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    expect(await screen.findByTestId('sign-up-confirmation')).toHaveTextContent(/new@example\.com/);
    // No session/access token yet in the confirmation-required path, so
    // profile fields cannot be persisted until the user confirms and signs in.
    expect(mockUpdateMyProfile).not.toHaveBeenCalled();
  });

  it('navigates back to sign in from the confirmation screen', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('sign-up-submit'));
    await screen.findByTestId('sign-up-confirmation');

    fireEvent.press(screen.getByTestId('sign-up-switch'));

    expect(mockOnSwitchToSignIn).toHaveBeenCalled();
  });

  it('calls onSwitchToSignIn when the footer Sign In link is pressed', () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    fireEvent.press(screen.getByTestId('sign-up-switch'));

    expect(mockOnSwitchToSignIn).toHaveBeenCalled();
  });

  it('calls onAccountCreated on a successful signup that requires email confirmation', async () => {
    const onAccountCreated = jest.fn();
    render(
      <SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} onAccountCreated={onAccountCreated} />,
    );
    fillValidForm();
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    await screen.findByTestId('sign-up-confirmation');

    expect(onAccountCreated).toHaveBeenCalledTimes(1);
  });

  it('does not call onAccountCreated when signup fails', async () => {
    mockSignUpWithPassword.mockResolvedValue({
      error: 'An account with this email already exists',
      requiresEmailConfirmation: false,
      accessToken: null,
    });
    const onAccountCreated = jest.fn();
    render(
      <SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} onAccountCreated={onAccountCreated} />,
    );
    fillValidForm();
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    await screen.findByTestId('sign-up-error');

    expect(onAccountCreated).not.toHaveBeenCalled();
  });

  it('does not crash when onAccountCreated is omitted', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fillValidForm();
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    expect(await screen.findByTestId('sign-up-confirmation')).toBeTruthy();
  });
});

// The submit button is disabled (and a real press is a no-op) whenever the
// form is invalid -- matching the screen's existing "disable until valid"
// convention. handleSubmit's own field-by-field validation is still real
// and reachable through a path that bypasses the button: submitting the
// keyboard (pressing Return/Done) from the last field, exactly like the
// original screen's `onSubmitEditing={handleSubmit}` wiring already did.
describe('SignUpScreen required-field validation', () => {
  function submitViaKeyboard() {
    fireEvent(screen.getByTestId('sign-up-confirm-password'), 'submitEditing');
  }

  it('shows "First name is required." and blocks submission', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fillValidForm({ firstName: '   ' });
    submitViaKeyboard();

    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent('First name is required.');
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();
  });

  it('shows "Last name is required." and blocks submission', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fillValidForm({ lastName: '   ' });
    submitViaKeyboard();

    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent('Last name is required.');
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();
  });

  it('shows "Display name is required." and blocks submission', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fillValidForm({ displayName: '   ' });
    submitViaKeyboard();

    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent(
      'Display name is required.',
    );
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();
  });

  it('shows "Username is required." and blocks submission', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fillValidForm({ username: '   ' });
    submitViaKeyboard();

    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent('Username is required.');
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();
  });

  it('rejects a malformed (too-short) username with a specific message', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fillValidForm({ username: 'ab' });
    submitViaKeyboard();

    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent(/3-20 characters/);
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();
  });

  it('shows "Passwords do not match." when submitted directly with mismatched passwords', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fillValidForm({ confirmPassword: 'somethingelse' });
    submitViaKeyboard();

    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent('Passwords do not match.');
    expect(mockSignUpWithPassword).not.toHaveBeenCalled();
  });
});

describe('SignUpScreen successful signup with an immediate session (auto-confirm)', () => {
  beforeEach(() => {
    mockSignUpWithPassword.mockResolvedValue({
      error: null,
      requiresEmailConfirmation: false,
      accessToken: 'token-abc',
    });
  });

  it('persists username and display name as their own separate, distinct fields', async () => {
    const onAccountCreated = jest.fn();
    render(
      <SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} onAccountCreated={onAccountCreated} />,
    );
    fillValidForm({
      firstName: 'Harbir',
      lastName: 'Bains',
      // Deliberately different from first name and username, so a passing
      // assertion proves display name is its own field, never derived.
      displayName: 'The Iron Harbir',
      username: 'HarbirB',
    });
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    await waitFor(() =>
      expect(mockUpdateMyProfile).toHaveBeenCalledWith('token-abc', {
        username: 'harbirb',
        displayName: 'The Iron Harbir',
      }),
    );
    expect(onAccountCreated).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('sign-up-confirmation')).toBeNull();
  });

  it('shows "That username is already taken" and lets the user retry without re-signing-up', async () => {
    mockUpdateMyProfile.mockRejectedValueOnce(new Error('That username is already taken'));
    const onAccountCreated = jest.fn();
    render(
      <SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} onAccountCreated={onAccountCreated} />,
    );
    fillValidForm({ username: 'taken' });
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent(
      'That username is already taken',
    );
    expect(onAccountCreated).not.toHaveBeenCalled();

    // Retry with a different username -- must not call signUpWithPassword again.
    mockUpdateMyProfile.mockResolvedValueOnce({});
    fireEvent.changeText(screen.getByTestId('sign-up-username'), 'available');
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    await waitFor(() => expect(onAccountCreated).toHaveBeenCalledTimes(1));
    expect(mockSignUpWithPassword).toHaveBeenCalledTimes(1);
    expect(mockUpdateMyProfile).toHaveBeenLastCalledWith('token-abc', {
      username: 'available',
      displayName: 'Harbir B',
    });
  });
});
