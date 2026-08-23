import { fireEvent, render, screen } from '@testing-library/react-native';
import App from './App';

interface MockAuthHandles {
  signInWithPassword: jest.Mock;
  signUp: jest.Mock;
  signOut: jest.Mock;
  reset: () => void;
}

// No native SDK involved in tests: wrapApp is the identity function, and
// setUser/clearUser calls are asserted directly instead of going through
// the real @sentry/react-native module.
jest.mock('./src/lib/sentry', () => ({
  initSentry: jest.fn(),
  wrapApp: (component: unknown) => component,
  setSentryUser: jest.fn(),
  clearSentryUser: jest.fn(),
}));

// babel-plugin-jest-hoist's out-of-scope check for jest.mock() factories
// misfires on TS `type`/`interface` declarations placed inside the factory
// (even local ones), so this stays untyped/`any` rather than referencing a
// named type. Typed access happens afterwards, through jest.requireMock().
/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('./src/lib/supabase', () => {
  let currentSession: any = null;
  let authChangeCallback: any;

  const mockSignInWithPassword = jest.fn(async ({ email, password }: any) => {
    if (password === 'wrong-password') {
      return {
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials' },
      };
    }
    currentSession = { user: { id: 'user-1', email } };
    if (authChangeCallback) authChangeCallback('SIGNED_IN', currentSession);
    return { data: { session: currentSession, user: currentSession.user }, error: null };
  });

  const mockSignUp = jest.fn(async ({ email }: any) => {
    // Simulates a project that requires email confirmation: no session yet.
    return { data: { session: null, user: { id: 'user-2', email } }, error: null };
  });

  const mockSignOut = jest.fn(async () => {
    currentSession = null;
    if (authChangeCallback) authChangeCallback('SIGNED_OUT', null);
    return { error: null };
  });

  const handles = {
    signInWithPassword: mockSignInWithPassword,
    signUp: mockSignUp,
    signOut: mockSignOut,
    reset: () => {
      currentSession = null;
      authChangeCallback = undefined;
      mockSignInWithPassword.mockClear();
      mockSignUp.mockClear();
      mockSignOut.mockClear();
    },
  };

  return {
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: currentSession } }),
        onAuthStateChange: (callback: any) => {
          authChangeCallback = callback;
          return { data: { subscription: { unsubscribe: jest.fn() } } };
        },
        signInWithPassword: mockSignInWithPassword,
        signUp: mockSignUp,
        signOut: mockSignOut,
      },
    },
    __mockAuth: handles,
  };
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const { __mockAuth: mockAuth } = jest.requireMock('./src/lib/supabase') as {
  __mockAuth: MockAuthHandles;
};
const mockSentry = jest.requireMock('./src/lib/sentry') as {
  setSentryUser: jest.Mock;
  clearSentryUser: jest.Mock;
};

beforeEach(() => {
  mockAuth.reset();
  mockSentry.setSentryUser.mockClear();
  mockSentry.clearSentryUser.mockClear();
});

describe('Authentication flow', () => {
  it('shows the sign-in screen once the initial session check completes', async () => {
    render(<App />);
    // Longer timeout than the other tests: this is the first test in the
    // file, so it also pays for one-time module/transform warm-up.
    expect(await screen.findByTestId('sign-in-email', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('signs in and shows the authenticated app shell', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    expect(await screen.findByText(/athlete@example\.com/)).toBeTruthy();
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'athlete@example.com',
      password: 'correct-password',
    });

    // Sentry gets the user id only — never the email or the password.
    expect(mockSentry.setSentryUser).toHaveBeenCalledWith('user-1');
    expect(mockSentry.setSentryUser).not.toHaveBeenCalledWith(
      expect.objectContaining({ email: expect.anything() }),
    );
    for (const call of mockSentry.setSentryUser.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('correct-password');
      expect(JSON.stringify(call)).not.toContain('athlete@example.com');
    }
  });

  it('shows an error message on invalid credentials and does not sign in', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'wrong-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    expect(await screen.findByTestId('sign-in-error')).toBeTruthy();
    expect(screen.queryByTestId('app-shell-email')).toBeNull();
  });

  it('switches to sign-up and shows the email-confirmation message', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    fireEvent.press(screen.getByTestId('sign-in-switch'));
    fireEvent.changeText(await screen.findByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    expect(await screen.findByTestId('sign-up-confirmation')).toBeTruthy();
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
    });
  });

  it('signs out and returns to the sign-in screen', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    await screen.findByTestId('sign-out-button');

    fireEvent.press(screen.getByTestId('sign-out-button'));

    expect(await screen.findByTestId('sign-in-email')).toBeTruthy();
    expect(mockAuth.signOut).toHaveBeenCalled();
    expect(mockSentry.clearSentryUser).toHaveBeenCalled();
  });
});
