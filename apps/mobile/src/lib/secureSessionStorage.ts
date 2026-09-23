import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as aesjs from 'aes-js';

/**
 * Supabase's auth storage adapter, backed by SecureStore rather than plain
 * AsyncStorage -- the session (JWT access/refresh tokens + user object) no
 * longer sits on disk in the clear. SecureStore alone can't hold the session
 * directly: its underlying Keychain/Keystore value size limit (2048 bytes)
 * is routinely exceeded by a real Supabase session. So only a small
 * per-key AES-256 encryption key lives in SecureStore; the encrypted
 * session blob itself (unbounded size) lives in AsyncStorage, unreadable
 * without that key. This is the pattern Supabase's own Expo guide documents
 * for exactly this constraint.
 */
export class SecureSessionStorage {
  private async encrypt(key: string, value: string): Promise<string> {
    const encryptionKey = await Crypto.getRandomBytesAsync(32);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
    return aesjs.utils.hex.fromBytes(encryptedBytes);
  }

  private async decrypt(key: string, value: string): Promise<string | null> {
    const encryptionKeyHex = await SecureStore.getItemAsync(key);
    if (!encryptionKeyHex) return null;
    const cipher = new aesjs.ModeOfOperation.ctr(
      aesjs.utils.hex.toBytes(encryptionKeyHex),
      new aesjs.Counter(1),
    );
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;
    // A missing SecureStore key (e.g. a pre-migration plaintext session, or
    // the Keychain/Keystore entry was cleared independently of AsyncStorage)
    // means this blob can never be decrypted -- treated as no session
    // rather than throwing, so Supabase just falls back to signed-out.
    return this.decrypt(key, encrypted);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(key, value);
    await AsyncStorage.setItem(key, encrypted);
  }
}
