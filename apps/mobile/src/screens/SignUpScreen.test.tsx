import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '../auth/AuthProvider';
import { SignUpScreen } from './SignUpScreen';

jest.mock('../auth/AuthProvider', () => ({
  useAuth: jest.fn(),
}));

const mockUseAuth = useAuth as jest.Mock;
const mockSignUpWithPassword = jest.fn();
const mockOnSwitchToSignIn = jest.fn();

beforeEach(() => {
  mockUseAuth.mockReturnValue({ signUpWithPassword: mockSignUpWithPassword });
  mockSignUpWithPassword
    .mockReset()
    .mockResolvedValue({ error: null, requiresEmailConfirmation: true });
  mockOnSwitchToSignIn.mockClear();
});

describe('SignUpScreen', () => {
  it('renders the logo, headline, and all fields', () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    expect(screen.getByText('Create your account')).toBeTruthy();
    expect(screen.getByText('Start tracking your progress.')).toBeTruthy();
    expect(screen.getByTestId('sign-up-email')).toBeTruthy();
    expect(screen.getByTestId('sign-up-password')).toBeTruthy();
    expect(screen.getByTestId('sign-up-confirm-password')).toBeTruthy();
  });

  it('disables submit until email, password, and a matching confirmation are present', () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    expect(screen.getByTestId('sign-up-submit').props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    expect(screen.getByTestId('sign-up-submit').props.accessibilityState?.disabled).toBe(true);

    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    expect(screen.getByTestId('sign-up-submit').props.accessibilityState?.disabled).toBe(false);
  });

  it('shows an inline error when the passwords do not match, and blocks submit', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'different');

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

    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'short');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'short');

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

  it('submits only email and password -- confirm password is never sent', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);

    fireEvent.changeText(screen.getByTestId('sign-up-email'), '  new@example.com  ');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    await waitFor(() =>
      expect(mockSignUpWithPassword).toHaveBeenCalledWith('new@example.com', 'password123'),
    );
  });

  it('shows a loading label and disables the button while submitting', async () => {
    let resolveSignUp: (value: {
      error: null;
      requiresEmailConfirmation: boolean;
    }) => void = () => {};
    mockSignUpWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveSignUp = resolve;
      }),
    );

    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    expect(await screen.findByText('Creating Account...')).toBeTruthy();
    expect(screen.getByTestId('sign-up-submit').props.accessibilityState?.disabled).toBe(true);

    resolveSignUp({ error: null, requiresEmailConfirmation: true });
    expect(await screen.findByTestId('sign-up-confirmation')).toBeTruthy();
  });

  it('shows a human-readable server error without crashing the form', async () => {
    mockSignUpWithPassword.mockResolvedValue({
      error: 'An account with this email already exists',
      requiresEmailConfirmation: false,
    });

    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    expect(await screen.findByTestId('sign-up-error')).toHaveTextContent(
      'An account with this email already exists',
    );
    expect(screen.queryByTestId('sign-up-confirmation')).toBeNull();
  });

  it('shows the confirmation screen after a successful signup requiring email confirmation', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    expect(await screen.findByTestId('sign-up-confirmation')).toHaveTextContent(/new@example\.com/);
  });

  it('navigates back to sign in from the confirmation screen', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
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
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    await screen.findByTestId('sign-up-confirmation');

    expect(onAccountCreated).toHaveBeenCalledTimes(1);
  });

  it('calls onAccountCreated on a successful signup that auto-confirms (no email step)', async () => {
    mockSignUpWithPassword.mockResolvedValue({ error: null, requiresEmailConfirmation: false });
    const onAccountCreated = jest.fn();
    render(
      <SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} onAccountCreated={onAccountCreated} />,
    );
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    await waitFor(() => expect(onAccountCreated).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('sign-up-confirmation')).toBeNull();
  });

  it('does not call onAccountCreated when signup fails', async () => {
    mockSignUpWithPassword.mockResolvedValue({
      error: 'An account with this email already exists',
      requiresEmailConfirmation: false,
    });
    const onAccountCreated = jest.fn();
    render(
      <SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} onAccountCreated={onAccountCreated} />,
    );
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    await screen.findByTestId('sign-up-error');

    expect(onAccountCreated).not.toHaveBeenCalled();
  });

  it('does not crash when onAccountCreated is omitted', async () => {
    render(<SignUpScreen onSwitchToSignIn={mockOnSwitchToSignIn} />);
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    expect(await screen.findByTestId('sign-up-confirmation')).toBeTruthy();
  });
});
