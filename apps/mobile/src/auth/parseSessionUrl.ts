export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Extracts access/refresh tokens from a Supabase auth redirect URL —
 * used for both the OAuth callback and the password-recovery email link,
 * which carry the same shape. Tokens can arrive in the fragment (#) or the
 * query string depending on flow/platform, so both are checked.
 */
export function parseTokensFromUrl(url: string): SessionTokens | null {
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');

  const candidates: string[] = [];
  if (hashIndex >= 0) candidates.push(url.slice(hashIndex + 1));
  if (queryIndex >= 0 && queryIndex !== hashIndex) {
    const end = hashIndex > queryIndex ? hashIndex : url.length;
    candidates.push(url.slice(queryIndex + 1, end));
  }

  for (const candidate of candidates) {
    const params = new URLSearchParams(candidate);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (accessToken && refreshToken) {
      return { accessToken, refreshToken };
    }
  }

  return null;
}
