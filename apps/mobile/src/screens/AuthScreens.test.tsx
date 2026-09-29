import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PrimaryButton } from '../design/Button';
import { expectNoBareText } from '../testUtils/expectNoBareText';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { ResetPasswordScreen } from './ResetPasswordScreen';
import { SignInScreen } from './SignInScreen';

const mockSignIn = jest.fn();

jest.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    signInWithPassword: mockSignIn,
    signInWithProvider: jest.fn().mockResolvedValue(null),
    requestPasswordReset: jest.fn().mockResolvedValue(null),
    updatePassword: jest.fn().mockResolvedValue(null),
  }),
}));

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

  // Regression guard: showLogo existed but was never actually passed
  // true anywhere (Sign Up/Welcome, its only intended consumers, were
  // folded into onboarding) -- the app's mark never appeared at all.
  it('Sign In: shows the Progresso mark and a welcoming title', () => {
    render(<SignInScreen onSwitchToSignUp={jest.fn()} onForgotPassword={jest.fn()} />);

    expect(screen.getByTestId('auth-frame-logo')).toBeTruthy();
    expect(screen.getByText('Welcome Back')).toBeTruthy();
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
});
