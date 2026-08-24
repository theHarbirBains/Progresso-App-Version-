import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { supabase } from '../lib/supabase';
import { clearSentryUser, setSentryUser } from '../lib/sentry';
import { signInWithOAuthProvider, type OAuthProvider } from './oauth';
import { parseTokensFromUrl } from './parseSessionUrl';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn' | 'passwordRecovery';

export interface SignUpResult {
  error: string | null;
  /** True when the project requires email confirmation before a session is issued. */
  requiresEmailConfirmation: boolean;
}

export interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUpWithPassword: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
  signInWithProvider: (provider: OAuthProvider) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

    // A password-recovery email link lands here (cold start or already
    // running). OAuth's own redirect is handled inline by
    // signInWithOAuthProvider instead, since it can wait synchronously on
    // the browser session's result rather than needing this listener —
    // but if the OS also delivers that same URL here, re-establishing the
    // same session is harmless.
    async function handleIncomingUrl(url: string | null) {
      if (!url) return;
      const tokens = parseTokensFromUrl(url);
      if (!tokens) return;
      await supabase.auth.setSession({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
      });
    }

    Linking.getInitialURL().then(handleIncomingUrl);
    const urlSubscription = Linking.addEventListener('url', ({ url }) => {
      void handleIncomingUrl(url);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setStatus(data.session ? 'signedIn' : 'signedOut');
      if (data.session?.user) {
        setSentryUser(data.session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;
      setSession(newSession);

      if (event === 'PASSWORD_RECOVERY') {
        setStatus('passwordRecovery');
      } else {
        setStatus(newSession ? 'signedIn' : 'signedOut');
      }

      if (newSession?.user) {
        setSentryUser(newSession.user.id);
      } else {
        clearSentryUser();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
      urlSubscription.remove();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      signInWithPassword: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      },
      signUpWithPassword: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        return {
          error: error?.message ?? null,
          requiresEmailConfirmation: !error && !data.session,
        };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      requestPasswordReset: async (email) => {
        const redirectTo = Linking.createURL('reset-password');
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
        return error?.message ?? null;
      },
      updatePassword: async (newPassword) => {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        return error?.message ?? null;
      },
      signInWithProvider: signInWithOAuthProvider,
    }),
    [status, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
