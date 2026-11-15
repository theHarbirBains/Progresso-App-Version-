import {
  isSupportedCountry,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

// Phone numbers, read the way libphonenumber-js (Google's phone-number rules) reads them: a
// number typed without its +code is taken as one from the person's own country (onboarding's
// country answer). Kept and matched in E.164 form (+16045551234) -- users.phone_e164, and the
// hashes Find People's Suggested sends (social/contactHashes.ts).

/** The country a number without its +code is read as, when it's one with phone numbers. */
export function phoneCountry(country: string | null | undefined): CountryCode | undefined {
  const code = country?.trim().toUpperCase();
  return code && isSupportedCountry(code) ? code : undefined;
}

/** A typed number as E.164, or null when it isn't a real number (for its country). */
export function toE164(input: string, country?: CountryCode): string | null {
  const text = input.trim();
  if (!text) return null;
  const parsed = parsePhoneNumberFromString(text, country);
  return parsed && parsed.isValid() ? parsed.number : null;
}

/** An E.164 number as it reads at home ("(604) 555-1234" in Canada), or with its +code abroad. */
export function formatPhone(e164: string, country?: CountryCode): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) return e164;
  return parsed.country !== undefined && parsed.country === country
    ? parsed.formatNational()
    : parsed.formatInternational();
}
