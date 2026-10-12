import { AppState, Text, type AppStateStatus } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { supabase } from '../lib/supabase';
import { AuthProvider, useAuth } from './AuthProvider';

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `progresso://${path}`),
  getInitialURL: jest.fn().mockResolvedValue(null),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
}));

jest.mock('../lib/sentry', () => ({
  setSentryUser: jest.fn(),
  clearSentryUser: jest.fn(),
}));

jest.mock('./oauth', () => ({
  signInWithOAuthProvider: jest.fn(),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      startAutoRefresh: jest.fn().mockResolvedValue(undefined),
      stopAutoRefresh: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

const mockSignUp = supabase.auth.signUp as jest.Mock;

beforeEach(() => {
  mockSignUp.mockReset().mockResolvedValue({ data: { session: null, user: null }, error: null });
});

// A thin consumer that exposes signUpWithPassword to a button press, since
// useAuth can only be read from inside an AuthProvider.
function SignUpProbe() {
  const { signUpWithPassword } = useAuth();
  return (
    <Text testID="probe" onPress={() => void signUpWithPassword('a@b.com', 'password123')}>
      probe
    </Text>
  );
}

describe('AuthProvider -- signUpWithPassword', () => {
  // Regression guard: without an explicit emailRedirectTo, Supabase's
  // confirmation email links to the project's default Site URL (a plain
  // website), not back into the app -- the global handleIncomingUrl
  // listener (this same file) that's supposed to pick up the resulting
  // session once the user taps "Confirm your email" would never fire.
  it('passes a deep-link emailRedirectTo so the confirmation email can hand a session back to the app', async () => {
    render(
      <AuthProvider>
        <SignUpProbe />
      </AuthProvider>,
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId('probe'));
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'password123',
      options: { emailRedirectTo: 'progresso://confirm-email' },
    });
  });
});

describe('AuthProvider -- token refresh while backgrounded', () => {
  beforeEach(() => {
    (supabase.auth.startAutoRefresh as jest.Mock).mockClear();
    (supabase.auth.stopAutoRefresh as jest.Mock).mockClear();
  });

  function appStateHandler(spy: jest.SpyInstance): (state: AppStateStatus) => void {
    const call = spy.mock.calls.find(([event]) => event === 'change');
    return call?.[1] as (state: AppStateStatus) => void;
  }

  it('stops token refresh in the background and restarts it when the app is active again', () => {
    const addEventListenerSpy = jest.spyOn(AppState, 'addEventListener');
    render(
      <AuthProvider>
        <Text>child</Text>
      </AuthProvider>,
    );
    const handler = appStateHandler(addEventListenerSpy);

    act(() => handler('background'));
    expect(supabase.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    expect(supabase.auth.startAutoRefresh).not.toHaveBeenCalled();

    act(() => handler('active'));
    expect(supabase.auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    addEventListenerSpy.mockRestore();
  });

  it('stops listening for app state changes once unmounted', () => {
    const remove = jest.fn();
    const addEventListenerSpy = jest
      .spyOn(AppState, 'addEventListener')
      .mockReturnValue({ remove } as unknown as ReturnType<typeof AppState.addEventListener>);
    const { unmount } = render(
      <AuthProvider>
        <Text>child</Text>
      </AuthProvider>,
    );

    unmount();

    expect(remove).toHaveBeenCalled();
    addEventListenerSpy.mockRestore();
  });
});
