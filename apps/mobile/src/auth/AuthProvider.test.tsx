import { Text } from 'react-native';
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
