import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import App from './App';

interface MockAuthHandles {
  signInWithPassword: jest.Mock;
  signUp: jest.Mock;
  signOut: jest.Mock;
  resetPasswordForEmail: jest.Mock;
  updateUser: jest.Mock;
  signInWithOAuth: jest.Mock;
  triggerUrl: (url: string) => void;
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

// AccountSettingsScreen's own profile fetch/save is covered by its own
// dedicated test file — mocked here purely so the sign-in/sign-out flow
// tests don't depend on it.
jest.mock('./src/lib/api', () => ({
  getMyProfile: jest.fn().mockResolvedValue({
    id: 'user-1',
    email: 'athlete@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
  }),
  updateMyProfile: jest.fn(),
}));

// DashboardScreen is now the post-sign-in landing screen. Its own data
// behavior is covered by DashboardScreen.test.tsx -- mocked here purely so
// the auth-flow tests aren't exercising (or failing on) direct Supabase
// reads that have nothing to do with authentication.
jest.mock('./src/workouts/workoutQueries', () => ({
  fetchActiveWorkout: jest.fn().mockResolvedValue(null),
}));
jest.mock('./src/dashboard/recentWorkoutInfo', () => ({
  fetchRecentWorkoutInfo: jest.fn().mockResolvedValue(null),
}));
jest.mock('./src/nutrition/foodLogQueries', () => ({
  fetchTodaysFoodLogs: jest.fn().mockResolvedValue([]),
}));
jest.mock('./src/nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn().mockResolvedValue({
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  }),
}));

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  createURL: jest.fn((path: string) => `progresso://${path}`),
}));

// oauth.ts calls maybeCompleteAuthSession() at module load time, so this
// must be mocked before anything imports it (transitively, via
// AuthProvider) or every test in this file fails at import time.
jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn().mockResolvedValue({
    type: 'success',
    url: 'progresso://auth-callback#access_token=a&refresh_token=b',
  }),
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
    currentSession = { user: { id: 'user-1', email }, access_token: 'access-token-1' };
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

  const mockResetPasswordForEmail = jest.fn(async (email: string) => {
    if (email === 'errors@example.com') {
      return { data: null, error: { message: 'Something went wrong' } };
    }
    return { data: {}, error: null };
  });

  const mockUpdateUser = jest.fn(async ({ password }: { password: string }) => {
    if (password === 'rejected-password') {
      return { data: null, error: { message: 'Password is too weak' } };
    }
    return { data: { user: currentSession?.user }, error: null };
  });

  const mockSignInWithOAuth = jest.fn(async () => ({
    data: { url: 'https://provider.example.com/authorize', provider: 'google' },
    error: null,
  }));

  const mockSetSession = jest.fn(async ({ access_token }: { access_token: string }) => {
    currentSession = { user: { id: 'oauth-user', email: 'oauth@example.com' }, access_token };
    if (authChangeCallback) authChangeCallback('SIGNED_IN', currentSession);
    return { data: { session: currentSession }, error: null };
  });

  const handles = {
    signInWithPassword: mockSignInWithPassword,
    signUp: mockSignUp,
    signOut: mockSignOut,
    resetPasswordForEmail: mockResetPasswordForEmail,
    updateUser: mockUpdateUser,
    signInWithOAuth: mockSignInWithOAuth,
    triggerUrl: (url: string) => {
      authChangeCallback?.('PASSWORD_RECOVERY', currentSession);
      void url;
    },
    reset: () => {
      currentSession = null;
      authChangeCallback = undefined;
      mockSignInWithPassword.mockClear();
      mockSignUp.mockClear();
      mockSignOut.mockClear();
      mockResetPasswordForEmail.mockClear();
      mockUpdateUser.mockClear();
      mockSignInWithOAuth.mockClear();
      mockSetSession.mockClear();
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
        resetPasswordForEmail: mockResetPasswordForEmail,
        updateUser: mockUpdateUser,
        signInWithOAuth: mockSignInWithOAuth,
        setSession: mockSetSession,
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

  it('signs in and shows the dashboard', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    expect(await screen.findByTestId('dashboard-greeting')).toBeTruthy();
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
    expect(screen.queryByTestId('dashboard-greeting')).toBeNull();
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
    await screen.findByTestId('dashboard-greeting');

    // Sign out lives on AccountSettingsScreen, reached from the dashboard's
    // settings affordance now that AccountSettingsScreen is no longer the
    // initial route.
    fireEvent.press(screen.getByTestId('open-account-settings'));
    await screen.findByTestId('sign-out-button');
    fireEvent.press(screen.getByTestId('sign-out-button'));

    expect(await screen.findByTestId('sign-in-email')).toBeTruthy();
    expect(mockAuth.signOut).toHaveBeenCalled();
    expect(mockSentry.clearSentryUser).toHaveBeenCalled();
  });
});

describe('Password recovery flow', () => {
  it('requests a reset email and shows the confirmation message', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    fireEvent.press(screen.getByTestId('sign-in-forgot-password'));
    fireEvent.changeText(await screen.findByTestId('forgot-password-email'), 'athlete@example.com');
    fireEvent.press(screen.getByTestId('forgot-password-submit'));

    expect(await screen.findByTestId('forgot-password-confirmation')).toBeTruthy();
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith(
      'athlete@example.com',
      expect.objectContaining({ redirectTo: expect.any(String) }),
    );
  });

  it('shows an error when the reset request fails', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    fireEvent.press(screen.getByTestId('sign-in-forgot-password'));
    fireEvent.changeText(await screen.findByTestId('forgot-password-email'), 'errors@example.com');
    fireEvent.press(screen.getByTestId('forgot-password-submit'));

    expect(await screen.findByTestId('forgot-password-error')).toBeTruthy();
  });

  it('can navigate back to sign in from the forgot-password screen', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    fireEvent.press(screen.getByTestId('sign-in-forgot-password'));
    fireEvent.press(await screen.findByTestId('forgot-password-back'));

    expect(await screen.findByTestId('sign-in-email')).toBeTruthy();
  });

  it('shows the reset-password screen once a recovery session is established', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    // Simulates the app receiving the password-reset deep link.
    await act(async () => {
      mockAuth.triggerUrl(
        'progresso://reset-password#access_token=a&refresh_token=b&type=recovery',
      );
    });

    expect(await screen.findByTestId('reset-password-new')).toBeTruthy();
  });

  it('updates the password and shows a success message', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');
    await act(async () => {
      mockAuth.triggerUrl(
        'progresso://reset-password#access_token=a&refresh_token=b&type=recovery',
      );
    });
    await screen.findByTestId('reset-password-new');

    fireEvent.changeText(screen.getByTestId('reset-password-new'), 'new-password-123');
    fireEvent.changeText(screen.getByTestId('reset-password-confirm'), 'new-password-123');
    fireEvent.press(screen.getByTestId('reset-password-submit'));

    expect(await screen.findByTestId('reset-password-success')).toBeTruthy();
    expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'new-password-123' });
  });

  it('rejects mismatched password confirmation without calling the API', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');
    await act(async () => {
      mockAuth.triggerUrl(
        'progresso://reset-password#access_token=a&refresh_token=b&type=recovery',
      );
    });
    await screen.findByTestId('reset-password-new');

    fireEvent.changeText(screen.getByTestId('reset-password-new'), 'new-password-123');
    fireEvent.changeText(screen.getByTestId('reset-password-confirm'), 'different-password');
    fireEvent.press(screen.getByTestId('reset-password-submit'));

    expect(await screen.findByTestId('reset-password-error')).toBeTruthy();
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });
});

describe('OAuth sign-in', () => {
  it('tapping "Continue with Google" starts the Supabase OAuth flow and completes sign-in', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-google'));
    });

    await waitFor(() => {
      expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'google', options: expect.any(Object) }),
      );
    });

    // The mocked browser session resolves with a redirect URL carrying
    // tokens, which should establish a real session and sign the user in.
    expect(await screen.findByTestId('dashboard-greeting')).toBeTruthy();
  });

  it('tapping "Continue with Apple" starts the Supabase OAuth flow', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    await act(async () => {
      fireEvent.press(screen.getByTestId('sign-in-apple'));
    });

    await waitFor(() => {
      expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'apple', options: expect.any(Object) }),
      );
    });
  });
});
