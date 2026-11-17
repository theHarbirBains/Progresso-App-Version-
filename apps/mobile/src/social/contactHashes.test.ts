import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { contactHashes, contactsAccess, normalizeEmail } from './contactHashes';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `HASH(${value})`),
}));

describe('contactHashes', () => {
  beforeEach(() => {
    jest.mocked(Contacts.Contact.getAllDetails).mockClear();
    jest.mocked(Contacts.requestPermissionsAsync).mockClear();
  });

  it('hashes each contact email and phone number once, on the phone', async () => {
    jest
      .mocked(Contacts.getPermissionsAsync)
      .mockResolvedValue({ status: 'granted', accessPrivileges: 'all' } as never);
    jest.mocked(Contacts.Contact.getAllDetails).mockResolvedValue([
      {
        id: 'c1',
        emails: [{ address: ' Sam@Example.com ' }, { address: 'not-an-email' }],
        phones: [{ number: '(604) 555-1234' }, { number: '555' }],
      },
      {
        id: 'c2',
        emails: [{ address: 'sam@example.com' }, { address: 'jo@test.local' }],
        phones: [{ number: '+1 604-555-1234' }, { number: '+44 7911 123456' }],
      },
      { id: 'c3' },
    ] as never);

    const result = await contactHashes('CA', { ask: false });

    expect(result.access).toBe('granted');
    expect(result.limited).toBe(false);
    expect(result.emailHashes.sort()).toEqual(['hash(jo@test.local)', 'hash(sam@example.com)']);
    // A number without its code is read as one from their own country; each once.
    expect(result.phoneHashes.sort()).toEqual(['hash(+16045551234)', 'hash(+447911123456)']);
    expect(Crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', 'sam@example.com');
    // Just the emails and phone numbers (ContactField.EMAILS and PHONES).
    expect(Contacts.Contact.getAllDetails).toHaveBeenCalledWith(['emails', 'phones']);
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
      limited: false,
      emailHashes: [],
      phoneHashes: [],
    });
    expect(Contacts.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(Contacts.Contact.getAllDetails).not.toHaveBeenCalled();

    await expect(contactHashes('CA', { ask: true })).resolves.toMatchObject({ access: 'granted' });
    expect(Contacts.requestPermissionsAsync).toHaveBeenCalledTimes(1);
  });

  it('reads nothing when Progresso may not see the contacts', async () => {
    jest.mocked(Contacts.requestPermissionsAsync).mockResolvedValue({ status: 'denied' } as never);

    await expect(contactHashes('CA', { ask: true })).resolves.toEqual({
      access: 'denied',
      limited: false,
      emailHashes: [],
      phoneHashes: [],
    });
    expect(Contacts.Contact.getAllDetails).not.toHaveBeenCalled();
  });

  it('says so when iPhone let Progresso see only the contacts picked', async () => {
    jest
      .mocked(Contacts.requestPermissionsAsync)
      .mockResolvedValue({ status: 'granted', accessPrivileges: 'limited' } as never);
    jest
      .mocked(Contacts.Contact.getAllDetails)
      .mockResolvedValue([{ id: 'c1', emails: [{ address: 'sam@example.com' }] }] as never);

    await expect(contactHashes('CA', { ask: true })).resolves.toEqual({
      access: 'granted',
      limited: true,
      emailHashes: ['hash(sam@example.com)'],
      phoneHashes: [],
    });
  });

  it("never calls expo-contacts' old functions, which only throw on the phone", async () => {
    jest
      .mocked(Contacts.getPermissionsAsync)
      .mockResolvedValue({ status: 'granted', accessPrivileges: 'all' } as never);
    jest.mocked(Contacts.Contact.getAllDetails).mockResolvedValue([] as never);

    await expect(contactHashes('CA', { ask: false })).resolves.toMatchObject({
      access: 'granted',
    });
    expect(Contacts.getContactsAsync).not.toHaveBeenCalled();
    await expect(Contacts.getContactsAsync()).rejects.toThrow(/only throws/);
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
