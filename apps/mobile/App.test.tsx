import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
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
// tests don't depend on it. onboardingCompletedAt is set (non-null) so
// these established test users land straight on Dashboard, matching a real
// pre-existing account that finished onboarding before this feature
// existed; the fresh-signup path (which DOES need onboarding) is covered
// separately below and in OnboardingScreen.test.tsx.
jest.mock('./src/lib/api', () => ({
  getMyProfile: jest.fn().mockResolvedValue({
    id: 'user-1',
    email: 'athlete@example.com',
    role: 'user',
    displayName: null,
    username: null,
    weightUnit: 'kg',
    onboardingCompletedAt: '2020-01-01T00:00:00.000Z',
  }),
  updateMyProfile: jest.fn(),
}));

// FeedScreen is now the post-sign-in landing screen. Its own data
// behavior is covered by feedQueries.test.ts -- mocked here purely so
// the auth-flow tests aren't exercising (or failing on) direct Supabase
// reads that have nothing to do with authentication.
jest.mock('./src/workouts/workoutQueries', () => ({
  fetchActiveWorkout: jest.fn().mockResolvedValue(null),
  fetchWorkoutsForDateRange: jest.fn().mockResolvedValue([]),
  fetchWorkoutHistory: jest.fn().mockResolvedValue({ rows: [], hasMore: false }),
}));
jest.mock('./src/workouts/prSummaryQueries', () => ({
  fetchAllRepPRs: jest.fn().mockResolvedValue([]),
  fetchAllOneRepMaxes: jest.fn().mockResolvedValue([]),
}));
jest.mock('./src/progress/progressStatsQueries', () => ({
  fetchAllCompletedWorkouts: jest.fn().mockResolvedValue([]),
}));
jest.mock('./src/workouts/allExerciseHistoryQueries', () => ({
  fetchAllExerciseHistory: jest.fn().mockResolvedValue([]),
}));
jest.mock('./src/dashboard/recentWorkoutInfo', () => ({
  fetchRecentWorkoutInfo: jest.fn().mockResolvedValue(null),
}));
jest.mock('./src/nutrition/foodLogQueries', () => ({
  fetchTodaysFoodLogs: jest.fn().mockResolvedValue([]),
  fetchWeeklyFoodLogs: jest.fn().mockResolvedValue([]),
}));
jest.mock('./src/nutrition/nutritionGoalQueries', () => ({
  fetchNutritionGoals: jest.fn().mockResolvedValue({
    calories: null,
    proteinG: null,
    carbsG: null,
    fatG: null,
  }),
}));

// ShareWorkoutScreen's native capture/share/save modules have no jest-expo
// auto-mock and are irrelevant to the auth-flow tests below -- mocked here
// purely so importing App.tsx (which statically imports every screen for
// the navigator) doesn't attempt to load real native modules. Their actual
// behavior is covered by ShareWorkoutScreen.test.tsx.
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));
jest.mock('expo-media-library', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  saveToLibraryAsync: jest.fn(),
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

  it('signs in and shows the feed', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    expect(await screen.findByTestId('feed-screen')).toBeTruthy();
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
    expect(screen.queryByTestId('feed-screen')).toBeNull();
  });

  it('switches to sign-up and shows the email-confirmation message', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    fireEvent.press(screen.getByTestId('sign-in-switch'));
    fireEvent.changeText(await screen.findByTestId('sign-up-first-name'), 'Harbir');
    fireEvent.changeText(screen.getByTestId('sign-up-last-name'), 'Bains');
    fireEvent.changeText(screen.getByTestId('sign-up-display-name'), 'Harbir Bains');
    fireEvent.changeText(screen.getByTestId('sign-up-username'), 'harbirb');
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    fireEvent.press(screen.getByTestId('sign-up-submit'));

    expect(await screen.findByTestId('sign-up-confirmation')).toBeTruthy();
    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'password123',
    });
  });

  it('shows Welcome after creating an account, then proceeds to Onboarding on Get Started', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    // Create the account (this mock always requires email confirmation).
    fireEvent.press(screen.getByTestId('sign-in-switch'));
    fireEvent.changeText(await screen.findByTestId('sign-up-first-name'), 'Harbir');
    fireEvent.changeText(screen.getByTestId('sign-up-last-name'), 'Bains');
    fireEvent.changeText(screen.getByTestId('sign-up-display-name'), 'Harbir Bains');
    fireEvent.changeText(screen.getByTestId('sign-up-username'), 'harbirb');
    fireEvent.changeText(screen.getByTestId('sign-up-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-up-password'), 'password123');
    fireEvent.changeText(screen.getByTestId('sign-up-confirm-password'), 'password123');
    fireEvent.press(screen.getByTestId('sign-up-submit'));
    await screen.findByTestId('sign-up-confirmation');

    // Simulates confirming via email out-of-band, then returning to sign in
    // normally -- the realistic path for a project that requires email
    // confirmation.
    fireEvent.press(screen.getByTestId('sign-up-switch'));
    fireEvent.changeText(await screen.findByTestId('sign-in-email'), 'new@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));

    // Welcome, not Dashboard, immediately after this fresh account's first
    // sign-in -- and Dashboard must not be reachable underneath it yet.
    expect(await screen.findByTestId('welcome-get-started')).toBeTruthy();
    expect(screen.queryByTestId('feed-screen')).toBeNull();

    fireEvent.press(screen.getByTestId('welcome-get-started'));

    // A fresh account goes into onboarding next, not straight to Dashboard --
    // the full step-by-step flow is covered by OnboardingScreen.test.tsx.
    expect(await screen.findByTestId('onboarding-step-apple-health')).toBeTruthy();
    expect(screen.queryByTestId('feed-screen')).toBeNull();
    // Onboarding is the one route that never shows the bottom navigation.
    expect(screen.queryByTestId('app-bottom-nav')).toBeNull();
  });

  it('signs out and returns to the sign-in screen', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    await screen.findByTestId('feed-screen');

    // Sign out lives on AccountSettingsScreen, reached via the You tab's
    // own settings affordance.
    fireEvent.press(screen.getByTestId('bottom-nav-you'));
    fireEvent.press(await screen.findByTestId('profile-open-settings'));
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
    expect(await screen.findByTestId('feed-screen')).toBeTruthy();
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

describe('App-level side menu', () => {
  async function signIn() {
    render(<App />);
    await screen.findByTestId('sign-in-email');
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    await screen.findByTestId('feed-screen');
  }

  it('renders as a sibling of the screen stack, not clipped inside Feed', async () => {
    await signIn();

    // The panel is always mounted (only its position animates), so it must
    // be findable even before it's opened -- and, critically, it must NOT
    // be a descendant of feed-screen, so that it can render above Feed's own
    // header/content/bottom nav rather than being clipped and z-index-fought
    // by them.
    const feedScreen = screen.getByTestId('feed-screen');
    expect(within(feedScreen).queryByTestId('app-menu-panel')).toBeNull();
    expect(screen.getByTestId('app-menu-panel')).toBeTruthy();
  });

  it('opens over the whole screen when the Feed hamburger button is pressed', async () => {
    await signIn();

    fireEvent.press(screen.getByTestId('feed-open-menu'));

    expect(screen.getByTestId('app-menu-backdrop')).toBeTruthy();
    // No Feed entry -- Feed is already one tap away via the bottom nav.
    expect(screen.queryByTestId('app-menu-item-Feed')).toBeNull();
    expect(screen.getByTestId('app-menu-item-WorkoutHistory')).toBeTruthy();
  });

  it('navigates to the pressed destination and closes the menu', async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('feed-open-menu'));

    fireEvent.press(screen.getByTestId('app-menu-item-WorkoutHistory'));

    expect(await screen.findByTestId('workout-history-open-menu')).toBeTruthy();
    expect(screen.queryByTestId('app-menu-backdrop')).toBeNull();
  });

  it('closes when the overlay/backdrop is pressed', async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('feed-open-menu'));
    expect(screen.getByTestId('app-menu-backdrop')).toBeTruthy();

    fireEvent.press(screen.getByTestId('app-menu-backdrop'));

    expect(screen.queryByTestId('app-menu-backdrop')).toBeNull();
    expect(screen.getByTestId('feed-screen')).toBeTruthy();
  });
});

describe('Nutrition-specific side menu', () => {
  async function signIn() {
    render(<App />);
    await screen.findByTestId('sign-in-email');
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    await screen.findByTestId('feed-screen');
  }

  it('shows the Workout menu (unchanged) from a Train screen', async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('bottom-nav-train'));
    await screen.findByTestId('workout-history-open-menu');

    fireEvent.press(screen.getByTestId('workout-history-open-menu'));

    expect(screen.getByText('Progresso')).toBeTruthy();
    expect(screen.getByTestId('app-menu-item-WorkoutHistory')).toBeTruthy();
    expect(screen.queryByTestId('app-menu-item-NutritionGoals')).toBeNull();
  });

  it('shows the Nutrition-branded menu, with Nutrition nav items, from the Nutrition tab', async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('bottom-nav-nutrition'));
    await screen.findByTestId('nutrition-today-open-menu');

    fireEvent.press(screen.getByTestId('nutrition-today-open-menu'));

    expect(screen.getByText('Progresso · Nutrition')).toBeTruthy();
    // No Nutrition (Home) entry -- it's already one tap away via the bottom nav.
    expect(screen.queryByTestId('app-menu-item-Nutrition')).toBeNull();
    expect(screen.getByTestId('app-menu-item-FoodLibrary')).toHaveTextContent(/Food/);
    expect(screen.getByTestId('app-menu-item-NutritionGoals')).toHaveTextContent(/Nutrition Goals/);
    expect(screen.getByTestId('app-menu-item-Nutrition History')).toHaveTextContent(/Coming Soon/);
    expect(screen.getByTestId('app-menu-item-Recipes')).toHaveTextContent(/Coming Soon/);
    expect(screen.getByTestId('app-menu-item-AccountSettings')).toHaveTextContent(/Settings/);
    // The Workout-only menu's own items must not leak into the Nutrition menu.
    expect(screen.queryByTestId('app-menu-item-WorkoutHistory')).toBeNull();
    expect(screen.queryByTestId('app-menu-item-ExerciseLibrary')).toBeNull();
  });

  it("navigates to the Nutrition Goals page via the Nutrition menu's Nutrition Goals item", async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('bottom-nav-nutrition'));
    await screen.findByTestId('nutrition-today-open-menu');
    fireEvent.press(screen.getByTestId('nutrition-today-open-menu'));

    fireEvent.press(screen.getByTestId('app-menu-item-NutritionGoals'));

    expect(await screen.findByTestId('nutrition-goals-scroll')).toBeTruthy();
    expect(screen.getByTestId('nutrition-goals-header')).toBeTruthy();
    expect(screen.queryByTestId('app-menu-backdrop')).toBeNull();
  });

  it('does not navigate anywhere when a coming-soon Nutrition menu row is pressed', async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('bottom-nav-nutrition'));
    await screen.findByTestId('nutrition-today-open-menu');
    fireEvent.press(screen.getByTestId('nutrition-today-open-menu'));

    fireEvent.press(screen.getByTestId('app-menu-item-Recipes'));

    // Still on Nutrition, menu still open -- nothing happened.
    expect(screen.getByTestId('nutrition-today-open-menu')).toBeTruthy();
    expect(screen.getByTestId('app-menu-backdrop')).toBeTruthy();
  });
});

describe('Train/Nutrition tab accents', () => {
  async function signIn() {
    render(<App />);
    await screen.findByTestId('sign-in-email');
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    await screen.findByTestId('feed-screen');
  }

  // There is no Workout/Nutrition toggle any more -- Train and Nutrition are
  // just two of the five fixed bottom-nav tabs, each always in its own fixed
  // accent when active (blue/green), regardless of how you got there.
  it('colors the Train tab in the Workout accent and the Nutrition tab in the Nutrition accent', async () => {
    await signIn();
    expect(screen.getByTestId('bottom-nav-train')).toHaveTextContent(/Train/);

    fireEvent.press(screen.getByTestId('bottom-nav-train'));
    await screen.findByTestId('workout-history-open-menu');
    let label = within(screen.getByTestId('bottom-nav-train')).getByText('Train');
    expect(StyleSheet.flatten(label.props.style).color).toBe('#2F80FF');

    fireEvent.press(screen.getByTestId('bottom-nav-nutrition'));
    await screen.findByTestId('nutrition-today-open-menu');
    label = within(screen.getByTestId('bottom-nav-nutrition')).getByText('Nutrition');
    expect(StyleSheet.flatten(label.props.style).color).toBe('#10B981');
  });
});

describe('App background', () => {
  async function signIn() {
    render(<App />);
    await screen.findByTestId('sign-in-email');
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    await screen.findByTestId('feed-screen');
  }

  // There is no photograph anywhere any more, and no screen treated
  // specially: every screen, Feed included, paints its own opaque
  // ScreenBackdrop with a soft glow in the current mode's accent (see
  // App.tsx's screenLayout). A previous screen can still be mounted
  // underneath during a transition, so this always reads the *last*
  // (topmost/current) glow, matching the order screens mount in.
  function currentGlowColor() {
    const glows = screen.getAllByTestId('screen-backdrop-glow');
    return glows[glows.length - 1].props.colors[0] as string;
  }

  it('shows no glow at all before sign-in', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    expect(screen.queryByTestId('app-background-glow')).toBeNull();
    expect(screen.queryByTestId('screen-backdrop-glow')).toBeNull();
  });

  it('gives every screen an opaque backdrop, Feed included', async () => {
    await signIn();

    expect(screen.getAllByTestId('screen-backdrop').length).toBeGreaterThan(0);
  });

  it('glows in the Workout accent on Feed by default', async () => {
    await signIn();

    expect(currentGlowColor()).toBe('rgba(47, 128, 255, 0.2)');
  });

  it('glows in the Nutrition accent once the user has visited Nutrition, even back on Feed', async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('bottom-nav-nutrition'));
    await screen.findByTestId('nutrition-today-open-menu');
    expect(currentGlowColor()).toBe('rgba(16, 185, 129, 0.2)');

    fireEvent.press(screen.getByTestId('bottom-nav-feed'));
    await screen.findByTestId('feed-screen');
    expect(currentGlowColor()).toBe('rgba(16, 185, 129, 0.2)');
  });

  it('glows blue again once the user is back on a Train screen', async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('bottom-nav-nutrition'));
    await screen.findByTestId('nutrition-today-open-menu');

    fireEvent.press(screen.getByTestId('bottom-nav-train'));
    await screen.findByTestId('workout-history-open-menu');

    expect(currentGlowColor()).toBe('rgba(47, 128, 255, 0.2)');
  });
});

describe('Persistent bottom navigation', () => {
  async function signIn() {
    render(<App />);
    await screen.findByTestId('sign-in-email');
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    await screen.findByTestId('feed-screen');
  }

  // There is exactly one bottom navigation in the app, a sibling of the
  // navigator, mounted once -- it shows up on Feed like every other screen,
  // with Feed active.
  it('renders the shared bottom nav on Feed, with Feed active, and only one instance', async () => {
    await signIn();

    expect(screen.getByTestId('app-bottom-nav')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-feed').props.accessibilityState.selected).toBe(true);
    expect(screen.getAllByTestId('bottom-nav-feed')).toHaveLength(1);
  });

  it('does not show the bottom nav on the sign-in screen (it renders outside the navigator)', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');

    expect(screen.queryByTestId('app-bottom-nav')).toBeNull();
  });

  it('navigates to Train/Nutrition directly from the shared bar, no toggle involved', async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('bottom-nav-train'));
    expect(await screen.findByTestId('workout-history-open-menu')).toBeTruthy();

    fireEvent.press(screen.getByTestId('bottom-nav-nutrition'));

    expect(await screen.findByTestId('nutrition-today-open-menu')).toBeTruthy();
  });

  // The whole point of this architecture: navigating off Feed must not make
  // the bottom nav disappear, and it must be the SAME instance (a sibling of
  // the navigator), not something each screen has to render itself.
  it('shows the global bottom nav, with You active, after navigating to a secondary screen', async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('bottom-nav-you'));
    await screen.findByTestId('profile-scroll');

    expect(screen.getByTestId('app-bottom-nav')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-you').props.accessibilityState.selected).toBe(true);
  });

  // AccountSettings is reached from Profile (a secondary/nested screen, not
  // one of the 5 tabs itself) -- it must keep You's tab highlighted rather
  // than showing no active tab.
  it("keeps a secondary screen's parent tab active, and the bar itself visible, on a screen nested under it", async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('bottom-nav-you'));
    await screen.findByTestId('profile-scroll');

    fireEvent.press(screen.getByTestId('profile-open-settings'));

    expect(await screen.findByTestId('sign-out-button')).toBeTruthy();
    expect(screen.getByTestId('app-bottom-nav')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-you').props.accessibilityState.selected).toBe(true);
  });

  it("navigates via the global bottom nav's tabs", async () => {
    await signIn();
    fireEvent.press(screen.getByTestId('bottom-nav-you'));
    await screen.findByTestId('profile-scroll');

    fireEvent.press(screen.getByTestId('bottom-nav-feed'));

    // Back on Feed: the same bar is still there with Feed now active,
    // proving the tab press actually navigated.
    await screen.findByTestId('feed-screen');
    expect(screen.getByTestId('app-bottom-nav')).toBeTruthy();
    expect(screen.getByTestId('bottom-nav-feed').props.accessibilityState.selected).toBe(true);
  });
});

describe('Bottom navigation backdrop', () => {
  function stripBackground() {
    let node = screen.getByTestId('app-bottom-nav').parent;
    for (let i = 0; i < 3 && node; i += 1) {
      const bg = StyleSheet.flatten(node.props.style)?.backgroundColor;
      if (bg) return bg;
      node = node.parent;
    }
    return undefined;
  }

  // There is no photograph anywhere any more, so the strip behind the bar is
  // always the opaque flat theme colour, on every screen.
  it('always sits on an opaque theme colour, never transparent', async () => {
    render(<App />);
    await screen.findByTestId('sign-in-email');
    fireEvent.changeText(screen.getByTestId('sign-in-email'), 'athlete@example.com');
    fireEvent.changeText(screen.getByTestId('sign-in-password'), 'correct-password');
    fireEvent.press(screen.getByTestId('sign-in-submit'));
    await screen.findByTestId('feed-screen');
    expect(stripBackground()).toBeTruthy();

    fireEvent.press(screen.getByTestId('bottom-nav-train'));
    await screen.findByTestId('workout-history-open-menu');
    expect(stripBackground()).toBeTruthy();
  });
});
