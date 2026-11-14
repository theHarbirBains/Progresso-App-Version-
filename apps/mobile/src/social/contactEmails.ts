import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';

/** What asking for the contacts came to. */
export type ContactsAccess = 'granted' | 'denied';

/** The most hashes sent at once (the API's own limit). */
const MAX_HASHES = 5000;

/** An email as it's matched: no spaces around it, lower case. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Asks for the phone's contacts (once; after that iPhone answers by itself) and, when allowed,
 * turns every email address in them into a SHA-256 hash of the normalized address -- on the
 * phone, so no address ever leaves it. Each address once.
 */
export async function contactEmailHashes(): Promise<{
  access: ContactsAccess;
  hashes: string[];
}> {
  const { status } = await Contacts.requestPermissionsAsync();
  if (status !== 'granted') return { access: 'denied', hashes: [] };
  const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Emails] });
  const emails = new Set<string>();
  for (const contact of data) {
    for (const entry of contact.emails ?? []) {
      if (entry.email && entry.email.includes('@')) emails.add(normalizeEmail(entry.email));
    }
  }
  const hashes = await Promise.all(
    Array.from(emails)
      .slice(0, MAX_HASHES)
      .map((email) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, email)),
  );
  return { access: 'granted', hashes: hashes.map((hash) => hash.toLowerCase()) };
}
