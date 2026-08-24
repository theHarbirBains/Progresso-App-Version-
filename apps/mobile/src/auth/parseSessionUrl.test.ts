import { parseTokensFromUrl } from './parseSessionUrl';

describe('parseTokensFromUrl', () => {
  it('extracts tokens from the URL fragment', () => {
    const tokens = parseTokensFromUrl(
      'progresso://auth-callback#access_token=abc&refresh_token=def',
    );
    expect(tokens).toEqual({ accessToken: 'abc', refreshToken: 'def' });
  });

  it('extracts tokens from the query string', () => {
    const tokens = parseTokensFromUrl(
      'progresso://auth-callback?access_token=abc&refresh_token=def',
    );
    expect(tokens).toEqual({ accessToken: 'abc', refreshToken: 'def' });
  });

  it('prefers the fragment when both a query string and fragment are present', () => {
    const tokens = parseTokensFromUrl(
      'progresso://auth-callback?foo=bar#access_token=frag-access&refresh_token=frag-refresh',
    );
    expect(tokens).toEqual({ accessToken: 'frag-access', refreshToken: 'frag-refresh' });
  });

  it('returns null when there is no access_token or refresh_token', () => {
    expect(parseTokensFromUrl('progresso://auth-callback')).toBeNull();
    expect(parseTokensFromUrl('progresso://auth-callback#foo=bar')).toBeNull();
  });

  it('returns null when only one of the two tokens is present', () => {
    expect(parseTokensFromUrl('progresso://auth-callback#access_token=abc')).toBeNull();
    expect(parseTokensFromUrl('progresso://auth-callback#refresh_token=def')).toBeNull();
  });

  it('handles a type=recovery param alongside the tokens (password reset link shape)', () => {
    const tokens = parseTokensFromUrl(
      'progresso://reset-password#access_token=abc&refresh_token=def&type=recovery',
    );
    expect(tokens).toEqual({ accessToken: 'abc', refreshToken: 'def' });
  });
});
