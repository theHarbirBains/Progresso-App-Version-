import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { contactEmailHashes, normalizeEmail } from './contactEmails';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `HASH(${value})`),
}));

describe('contactEmailHashes', () => {
  it('hashes each contact email once, trimmed and lower-cased, on the phone', async () => {
    jest.mocked(Contacts.requestPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
    jest.mocked(Contacts.getContactsAsync).mockResolvedValue({
      data: [
        { emails: [{ email: ' Sam@Example.com ' }, { email: 'not-an-email' }] },
        { emails: [{ email: 'sam@example.com' }, { email: 'jo@test.local' }] },
        { name: 'No email' },
      ],
    } as never);

    const result = await contactEmailHashes();

    expect(result.access).toBe('granted');
    expect(result.hashes.sort()).toEqual(['hash(jo@test.local)', 'hash(sam@example.com)']);
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', 'sam@example.com');
  });

  it('reads nothing when Progresso may not see the contacts', async () => {
    jest.mocked(Contacts.requestPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);
    jest.mocked(Contacts.getContactsAsync).mockClear();

    await expect(contactEmailHashes()).resolves.toEqual({ access: 'denied', hashes: [] });
    expect(Contacts.getContactsAsync).not.toHaveBeenCalled();
  });

  it('normalizes an email the way it is matched', () => {
    expect(normalizeEmail('  Jo@Test.Local ')).toBe('jo@test.local');
  });
});
