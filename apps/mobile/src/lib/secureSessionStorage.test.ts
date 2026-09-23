import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { SecureSessionStorage } from './secureSessionStorage';

describe('SecureSessionStorage', () => {
  let storage: SecureSessionStorage;

  beforeEach(async () => {
    storage = new SecureSessionStorage();
    await AsyncStorage.clear();
  });

  it('round-trips a value through set/get', async () => {
    await storage.setItem('sb-session', JSON.stringify({ access_token: 'abc.def.ghi' }));

    expect(await storage.getItem('sb-session')).toBe(
      JSON.stringify({ access_token: 'abc.def.ghi' }),
    );
  });

  // The entire reason for this adapter over plain SecureStore: SecureStore's
  // own Keychain/Keystore-backed value size limit (2048 bytes) is routinely
  // exceeded by a real Supabase session (JWT access + refresh token + full
  // user object). Only the small AES key goes into SecureStore; the
  // unbounded encrypted blob goes into AsyncStorage.
  it('round-trips a value larger than SecureStore\'s 2048-byte limit', async () => {
    const largeValue = JSON.stringify({
      access_token: 'x'.repeat(1500),
      refresh_token: 'y'.repeat(800),
      user: { id: 'user-1', email: 'a@example.com', identities: 'z'.repeat(500) },
    });
    expect(largeValue.length).toBeGreaterThan(2048);

    await storage.setItem('sb-session', largeValue);

    expect(await storage.getItem('sb-session')).toBe(largeValue);
  });

  it('never stores the plaintext value in AsyncStorage', async () => {
    const secret = 'super-secret-access-token';
    await storage.setItem('sb-session', secret);

    const rawStored = await AsyncStorage.getItem('sb-session');
    expect(rawStored).not.toBeNull();
    expect(rawStored).not.toContain(secret);
  });

  it('returns null when nothing has been stored', async () => {
    expect(await storage.getItem('sb-session')).toBeNull();
  });

  // A SecureStore entry can go missing independently of the AsyncStorage
  // blob (e.g. cleared by the OS, or a pre-migration plaintext session with
  // no key at all) -- this must degrade to "no session", never throw.
  it('returns null (not a throw) when the AsyncStorage blob exists but the SecureStore key does not', async () => {
    await storage.setItem('sb-session', 'some value');
    await SecureStore.deleteItemAsync('sb-session');

    await expect(storage.getItem('sb-session')).resolves.toBeNull();
  });

  it('removeItem clears both the encrypted blob and the encryption key', async () => {
    await storage.setItem('sb-session', 'some value');

    await storage.removeItem('sb-session');

    expect(await AsyncStorage.getItem('sb-session')).toBeNull();
    expect(await SecureStore.getItemAsync('sb-session')).toBeNull();
    expect(await storage.getItem('sb-session')).toBeNull();
  });

  it('uses a distinct encryption key per storage key', async () => {
    await storage.setItem('sb-session-a', 'value-a');
    await storage.setItem('sb-session-b', 'value-b');

    const keyA = await SecureStore.getItemAsync('sb-session-a');
    const keyB = await SecureStore.getItemAsync('sb-session-b');
    expect(keyA).not.toBeNull();
    expect(keyB).not.toBeNull();

    // Cross-reading with the wrong stored blob must not silently succeed.
    const blobA = await AsyncStorage.getItem('sb-session-a');
    await AsyncStorage.setItem('sb-session-b', blobA ?? '');
    expect(await storage.getItem('sb-session-b')).not.toBe('value-a');
  });
});
