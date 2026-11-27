import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// A health provider's OAuth tokens (Oura, Phase 4) are encrypted by the API before they're
// stored (health_provider_tokens), so a copy of the database alone never holds a usable token.
// AES-256-GCM with HEALTH_TOKEN_KEY; each value bound to its connection (the additional data), so
// a value moved onto another connection's row doesn't decrypt. Unused until Oura is built.

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';

/** HEALTH_TOKEN_KEY as a key: 32 bytes, base64. Empty means tokens can't be stored yet. */
export function healthTokenKey(raw: string): Buffer | null {
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('HEALTH_TOKEN_KEY must be 32 bytes, base64-encoded');
  }
  return key;
}

/** "v1:<iv>:<tag>:<ciphertext>", each part base64. */
export function encryptHealthToken(plain: string, key: Buffer, connectionId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(Buffer.from(connectionId, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

export function decryptHealthToken(stored: string, key: Buffer, connectionId: string): string {
  const [version, iv, tag, ciphertext, ...rest] = stored.split(':');
  if (version !== VERSION || !iv || !tag || ciphertext === undefined || rest.length > 0) {
    throw new Error('Not a stored health token');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64'));
  decipher.setAAD(Buffer.from(connectionId, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
