import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PrimaryButton } from '../design/Button';
import { colors } from '../design/theme';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { ResetPasswordScreen } from './ResetPasswordScreen';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';
import { WelcomeScreen } from './WelcomeScreen';

const mockSignIn = jest.fn();

jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    signInWithPassword: mockSignIn,
    signInWithProvider: jest.fn().mockResolvedValue(null),
    signUpWithPassword: jest.fn().mockResolvedValue({ error: null, accessToken: null }),
    requestPasswordReset: jest.fn().mockResolvedValue(null),
    updatePassword: jest.fn().mockResolvedValue(null),
  }),
}));

jest.mock('../lib/api', () => ({ updateMyProfile: jest.fn() }));

beforeEach(() => {
  mockSignIn.mockReset().mockResolvedValue(null);
});

describe('Signed-out screens -- one frame, shared inputs, one filled button', () => {
  it('Sign In: labelled inputs, exactly one filled button, Google/Apple outlined', () => {
    render(<SignInScreen onSwitchToSignUp={jest.fn()} onForgotPassword={jest.fn()} />);

    expect(screen.getByTestId('sign-in-email').props.accessibilityLabel).toBe('Email');
    expect(screen.getByTestId('sign-in-password').props.accessibilityLabel).toBe('Password');
    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    for (const id of ['sign-in-google', 'sign-in-apple']) {
      const style = StyleSheet.flatten(screen.getByTestId(id).props.style);
      expect(style.backgroundColor).toBeUndefined();
      expect(style.borderWidth).toBe(1);
    }
    expectNoBareText();
  });

  it('Sign In: the links are plain 44pt text actions', () => {
    render(<SignInScreen onSwitchToSignUp={jest.fn()} onForgotPassword={jest.fn()} />);

    for (const id of ['sign-in-forgot-password', 'sign-in-switch']) {
      const style = StyleSheet.flatten(screen.getByTestId(id).props.style);
      expect(style.borderWidth).toBeUndefined();
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('Sign In: shows Sign In as busy while submitting', async () => {
    mockSignIn.mockReturnValue(new Promise(() => undefined));
    render(<SignInScreen onSwitchToSignUp={jest.fn()} onForgotPassword={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'a@b.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'secret1');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    expect((await screen.findByTestId('sign-in-submit')).props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });

  it('Sign Up: labelled fields, the show/hide eye is a named toggle, one filled button', () => {
    render(<SignUpScreen onSwitchToSignIn={jest.fn()} />);

    expect(screen.getByTestId('sign-up-first-name').props.accessibilityLabel).toBe('First Name');
    expect(screen.getByTestId('sign-up-confirm-password').props.accessibilityLabel).toBe(
      'Confirm Password',
    );
    const toggle = screen.getByTestId('sign-up-password-toggle');
    expect(toggle.props.accessibilityLabel).toBe('Show password');
    fireEvent.press(toggle);
    expect(screen.getByTestId('sign-up-password-toggle').props.accessibilityLabel).toBe(
      'Hide password',
    );
    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    expectNoBareText();
  });

  it('Sign Up: a password mismatch shows on the field, in the destructive colour', () => {
    render(<SignUpScreen onSwitchToSignIn={jest.fn()} />);

    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'secret1');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'secret2');

    const mismatch = screen.getByTestId('sign-up-password-mismatch');
    expect(mismatch).toHaveTextContent("Passwords don't match");
    expect(StyleSheet.flatten(mismatch.props.style).color).toBe(colors.destructive);
  });

  it('Forgot Password and Reset Password: labelled input, one filled button, no bare text', () => {
    const forgot = render(<ForgotPasswordScreen onBackToSignIn={jest.fn()} />);
    expect(screen.getByTestId('forgot-password-email').props.accessibilityLabel).toBe('Email');
    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    expectNoBareText();
    forgot.unmount();

    render(<ResetPasswordScreen />);
    expect(screen.getByTestId('reset-password-new').props.accessibilityLabel).toBe('New password');
    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    expectNoBareText();
  });

  it('Welcome: three plain rows and one filled Get Started', () => {
    const onGetStarted = jest.fn();
    render(<WelcomeScreen onGetStarted={onGetStarted} />);

    expect(screen.getByText('Track workouts and progressive overload')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(PrimaryButton)).toHaveLength(1);
    fireEvent.press(screen.getByTestId('welcome-get-started'));
    expect(onGetStarted).toHaveBeenCalled();
    expectNoBareText();
  });
});
