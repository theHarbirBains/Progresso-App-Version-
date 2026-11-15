import { formatPhone, phoneCountry, toE164 } from './phoneNumbers';

describe('phoneNumbers', () => {
  it('reads a number typed without its code as one from their country', () => {
    expect(toE164('(604) 555-1234', 'CA')).toBe('+16045551234');
    expect(toE164('604.555.1234', 'CA')).toBe('+16045551234');
    expect(toE164('07911 123456', 'GB')).toBe('+447911123456');
  });

  it('takes a number with its +code from anywhere', () => {
    expect(toE164('+44 7911 123456', 'CA')).toBe('+447911123456');
    expect(toE164('+1 604 555 1234')).toBe('+16045551234');
  });

  it('refuses what is not a real number', () => {
    expect(toE164('', 'CA')).toBeNull();
    expect(toE164('12345', 'CA')).toBeNull();
    expect(toE164('604 555', 'CA')).toBeNull();
    expect(toE164('(604) 555-1234')).toBeNull();
  });

  it('knows only countries with phone numbers', () => {
    expect(phoneCountry('ca')).toBe('CA');
    expect(phoneCountry(null)).toBeUndefined();
    expect(phoneCountry('ZZ')).toBeUndefined();
  });

  it('shows a number as it reads at home, or with its code abroad', () => {
    expect(formatPhone('+16045551234', 'CA')).toBe('(604) 555-1234');
    expect(formatPhone('+447911123456', 'CA')).toBe('+44 7911 123456');
  });
});
