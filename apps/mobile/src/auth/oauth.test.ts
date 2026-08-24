import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { signInWithOAuthProvider } from './oauth';

jest.mock('expo-linking', () => ({
  createURL: jest.fn((path: string) => `progresso://${path}`),
}));

jest.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: jest.fn(),
  openAuthSessionAsync: jest.fn(),
}));

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
      setSession: jest.fn(),
    },
  },
}));

const mockSignInWithOAuth = supabase.auth.signInWithOAuth as jest.Mock;
const mockSetSession = supabase.auth.setSession as jest.Mock;
const mockOpenAuthSessionAsync = WebBrowser.openAuthSessionAsync as jest.Mock;

beforeEach(() => {
  mockSignInWithOAuth.mockReset();
  mockSetSession.mockReset();
  mockOpenAuthSessionAsync.mockReset();
});

describe('signInWithOAuthProvider', () => {
  it('opens the auth session and establishes a session on success', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://provider.example.com/authorize' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'progresso://auth-callback#access_token=abc&refresh_token=def',
    });
    mockSetSession.mockResolvedValue({ error: null });

    const result = await signInWithOAuthProvider('google');

    expect(result).toBeNull();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'progresso://auth-callback', skipBrowserRedirect: true },
    });
    expect(mockOpenAuthSessionAsync).toHaveBeenCalledWith(
      'https://provider.example.com/authorize',
      'progresso://auth-callback',
    );
    expect(mockSetSession).toHaveBeenCalledWith({ access_token: 'abc', refresh_token: 'def' });
  });

  it('returns the error message when signInWithOAuth fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: null,
      error: { message: 'provider unavailable' },
    });

    const result = await signInWithOAuthProvider('apple');

    expect(result).toBe('provider unavailable');
    expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('returns an error when no authorize URL is returned', async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });

    const result = await signInWithOAuthProvider('google');

    expect(result).toBe('Failed to start sign-in');
    expect(mockOpenAuthSessionAsync).not.toHaveBeenCalled();
  });

  it('returns null without error when the user cancels the browser session', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://provider.example.com/authorize' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'cancel' });

    const result = await signInWithOAuthProvider('google');

    expect(result).toBeNull();
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('returns null without error when the user dismisses the browser session', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://provider.example.com/authorize' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'dismiss' });

    const result = await signInWithOAuthProvider('apple');

    expect(result).toBeNull();
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('returns an error when the browser session resolves without a usable URL', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://provider.example.com/authorize' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({ type: 'success', url: undefined });

    const result = await signInWithOAuthProvider('google');

    expect(result).toBe('Sign-in was not completed');
  });

  it('returns an error when the redirect URL has no valid tokens', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://provider.example.com/authorize' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'progresso://auth-callback',
    });

    const result = await signInWithOAuthProvider('google');

    expect(result).toBe('Sign-in did not return a valid session');
    expect(mockSetSession).not.toHaveBeenCalled();
  });

  it('returns the error message when setSession fails', async () => {
    mockSignInWithOAuth.mockResolvedValue({
      data: { url: 'https://provider.example.com/authorize' },
      error: null,
    });
    mockOpenAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'progresso://auth-callback#access_token=abc&refresh_token=def',
    });
    mockSetSession.mockResolvedValue({ error: { message: 'invalid token' } });

    const result = await signInWithOAuthProvider('google');

    expect(result).toBe('invalid token');
  });
});
