import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../lib/supabase';
import { parseTokensFromUrl } from './parseSessionUrl';

// Required once so a completed browser auth session properly closes/hands
// control back to the app (matters most on web; harmless elsewhere).
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';

/**
 * Web-redirect OAuth via Supabase (not the native Google/Apple SDKs) —
 * works inside Expo Go with no custom native code. Real native
 * Sign-In-with-Apple polish is a later, EAS-build-dependent milestone.
 */
export async function signInWithOAuthProvider(provider: OAuthProvider): Promise<string | null> {
  const redirectTo = Linking.createURL('auth-callback');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error) {
    return error.message;
  }
  if (!data?.url) {
    return 'Failed to start sign-in';
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === 'cancel' || result.type === 'dismiss') {
    return null;
  }
  if (result.type !== 'success' || !result.url) {
    return 'Sign-in was not completed';
  }

  const tokens = parseTokensFromUrl(result.url);
  if (!tokens) {
    return 'Sign-in did not return a valid session';
  }

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  return sessionError?.message ?? null;
}
