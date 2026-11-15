import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import type { CountryCode } from 'libphonenumber-js';
import { toE164 } from '../lib/phoneNumbers';

/** Whether Progresso may read the contacts: yes, no, or not asked yet. */
export type ContactsAccess = 'granted' | 'denied' | 'undetermined';

/** What the contacts came to: each email and phone number in them, hashed. */
export interface ContactHashes {
  access: ContactsAccess;
  emailHashes: string[];
  phoneHashes: string[];
}

/** The most hashes of each kind sent at once (the API's own limit). */
const MAX_HASHES = 5000;

/** An email as it's matched: no spaces around it, lower case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Whether Progresso may read the contacts -- without asking. */
export async function contactsAccess(): Promise<ContactsAccess> {
  const { status } = await Contacts.getPermissionsAsync();
  return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
}

function sha256(values: Set<string>): Promise<string[]> {
  return Promise.all(
    Array.from(values)
      .slice(0, MAX_HASHES)
      .map(async (value) =>
        (await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value)).toLowerCase(),
      ),
  );
}

/**
 * Reads the phone's contacts -- asking first, only when `ask` (after that iPhone answers by
 * itself) -- and turns every email address and phone number in them into a SHA-256 hash, on the
 * phone, so no address or number ever leaves it: an email trimmed and lower-cased, a number in
 * E.164 form (one without its +code taken as from `country`, the person's own). Each once.
 */
export async function contactHashes(
  country: CountryCode | undefined,
  { ask }: { ask: boolean },
): Promise<ContactHashes> {
  const status = ask ? (await Contacts.requestPermissionsAsync()).status : await contactsAccess();
  if (status !== 'granted') {
    return {
      access: status === 'denied' ? 'denied' : 'undetermined',
      emailHashes: [],
      phoneHashes: [],
    };
  }
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Emails, Contacts.Fields.PhoneNumbers],
  });
  const emails = new Set<string>();
  const phones = new Set<string>();
  for (const contact of data) {
    for (const entry of contact.emails ?? []) {
      if (entry.email && entry.email.includes('@')) emails.add(normalizeEmail(entry.email));
    }
    for (const entry of contact.phoneNumbers ?? []) {
      const e164 = toE164(entry.number ?? '', country);
      if (e164) phones.add(e164);
    }
  }
  const [emailHashes, phoneHashes] = await Promise.all([sha256(emails), sha256(phones)]);
  return { access: 'granted', emailHashes, phoneHashes };
}
