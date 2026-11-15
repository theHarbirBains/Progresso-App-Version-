import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { contactHashes, contactsAccess, normalizeEmail } from './contactHashes';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `HASH(${value})`),
}));

describe('contactHashes', () => {
  beforeEach(() => {
    jest.mocked(Contacts.getContactsAsync).mockClear();
    jest.mocked(Contacts.requestPermissionsAsync).mockClear();
  });

  it('hashes each contact email and phone number once, on the phone', async () => {
    jest.mocked(Contacts.getPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);
    jest.mocked(Contacts.getContactsAsync).mockResolvedValue({
      data: [
        {
          emails: [{ email: ' Sam@Example.com ' }, { email: 'not-an-email' }],
          phoneNumbers: [{ number: '(604) 555-1234' }, { number: '555' }],
        },
        {
          emails: [{ email: 'sam@example.com' }, { email: 'jo@test.local' }],
          phoneNumbers: [{ number: '+1 604-555-1234' }, { number: '+44 7911 123456' }],
        },
        { name: 'Nothing to match' },
      ],
    } as never);

    const result = await contactHashes('CA', { ask: false });

    expect(result.access).toBe('granted');
    expect(result.emailHashes.sort()).toEqual(['hash(jo@test.local)', 'hash(sam@example.com)']);
    // A number without its code is read as one from their own country; each once.
    expect(result.phoneHashes.sort()).toEqual(['hash(+16045551234)', 'hash(+447911123456)']);
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', 'sam@example.com');
    expect(Contacts.getContactsAsync).toHaveBeenCalledWith({
      fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
    });
    // Allowed already: nothing asked.
    expect(Contacts.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('asks first only when told to', async () => {
    jest
      .mocked(Contacts.getPermissionsAsync)
      .mockResolvedValue({ status: 'undetermined' } as never);
    jest.mocked(Contacts.requestPermissionsAsync).mockResolvedValue({ status: 'granted' } as never);

    await expect(contactHashes('CA', { ask: false })).resolves.toEqual({
      access: 'undetermined',
      emailHashes: [],
      phoneHashes: [],
    });
    expect(Contacts.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Contacts.getContactsAsync).not.toHaveBeenCalled();

    await expect(contactHashes('CA', { ask: true })).resolves.toMatchObject({ access: 'granted' });
    expect(Contacts.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('reads nothing when Progresso may not see the contacts', async () => {
    jest.mocked(Contacts.requestPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);

    await expect(contactHashes('CA', { ask: true })).resolves.toEqual({
      access: 'denied',
      emailHashes: [],
      phoneHashes: [],
    });
    expect(Contacts.getContactsAsync).not.toHaveBeenCalled();
  });

  it('says whether the contacts may be read, without asking', async () => {
    jest.mocked(Contacts.getPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);
    await expect(contactsAccess()).resolves.toBe('denied');
    expect(Contacts.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('normalizes an email the way it is matched', () => {
    expect(normalizeEmail('  Jo@Test.Local ')).toBe('jo@test.local');
  });
});
