import type { Session, User } from '@supabase/supabase-js';
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

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;

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
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setStatus(newSession ? 'signedIn' : 'signedOut');
      if (newSession?.user) {
        setSentryUser(newSession.user.id);
      } else {
        clearSentryUser();
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
