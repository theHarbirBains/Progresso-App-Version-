import { randomBytes } from 'node:crypto';
import { validate } from '../config/env.validation';
import { decryptHealthToken, encryptHealthToken, healthTokenKey } from './health-token-crypto';

const key = randomBytes(32);

describe('health provider tokens', () => {
  it('are stored encrypted, and read back only with the key and their own connection', () => {
    const stored = encryptHealthToken('oura-access-token', key, 'connection-1');
    expect(stored).not.toContain('oura-access-token');
    expect(stored.startsWith('v1:')).toBe(true);
    expect(decryptHealthToken(stored, key, 'connection-1')).toBe('oura-access-token');
  });

  it('never decrypt on another connection’s row, with another key, or altered', () => {
    const stored = encryptHealthToken('secret', key, 'connection-1');
    expect(() => decryptHealthToken(stored, key, 'connection-2')).toThrow();
    expect(() => decryptHealthToken(stored, randomBytes(32), 'connection-1')).toThrow();
    const [v, iv, tag, data] = stored.split(':');
    const altered = [v, iv, tag, Buffer.from('tampered').toString('base64')].join(':');
    expect(() => decryptHealthToken(altered, key, 'connection-1')).toThrow();
    expect(() => decryptHealthToken(`${data}`, key, 'connection-1')).toThrow(
      'Not a stored health token',
    );
  });

  it('are encrypted differently each time', () => {
    expect(encryptHealthToken('same', key, 'c')).not.toBe(encryptHealthToken('same', key, 'c'));
  });

  it('need a 32-byte key; none means none can be stored', () => {
    expect(healthTokenKey('')).toBeNull();
    expect(healthTokenKey(key.toString('base64'))?.equals(key)).toBe(true);
    expect(() => healthTokenKey(randomBytes(16).toString('base64'))).toThrow('32 bytes');
  });
});

describe('the health settings', () => {
  const base = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'k' };

  it('collect nothing unless HEALTH_DATA_ENABLED is "true"', () => {
    expect(validate(base).HEALTH_DATA_ENABLED).toBe(false);
    expect(validate({ ...base, HEALTH_DATA_ENABLED: 'false' }).HEALTH_DATA_ENABLED).toBe(false);
    expect(validate({ ...base, HEALTH_DATA_ENABLED: 'true' }).HEALTH_DATA_ENABLED).toBe(true);
  });

  it('refuse to start with a token key that isn’t 32 bytes', () => {
    expect(() => validate({ ...base, HEALTH_TOKEN_KEY: 'short' })).toThrow('HEALTH_TOKEN_KEY');
    expect(validate({ ...base, HEALTH_TOKEN_KEY: key.toString('base64') }).HEALTH_TOKEN_KEY).toBe(
      key.toString('base64'),
    );
  });
});
