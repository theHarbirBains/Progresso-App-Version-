import { getGreeting, greetingName } from './greeting';

describe('getGreeting', () => {
  it('returns "Good morning" before noon', () => {
    expect(getGreeting(new Date(2026, 0, 1, 6, 0))).toBe('Good morning');
    expect(getGreeting(new Date(2026, 0, 1, 11, 59))).toBe('Good morning');
  });

  it('returns "Good afternoon" from noon up to 5pm', () => {
    expect(getGreeting(new Date(2026, 0, 1, 12, 0))).toBe('Good afternoon');
    expect(getGreeting(new Date(2026, 0, 1, 16, 59))).toBe('Good afternoon');
  });

  it('returns "Good evening" from 5pm onward', () => {
    expect(getGreeting(new Date(2026, 0, 1, 17, 0))).toBe('Good evening');
    expect(getGreeting(new Date(2026, 0, 1, 23, 59))).toBe('Good evening');
  });

  it('wraps around correctly just after midnight', () => {
    expect(getGreeting(new Date(2026, 0, 1, 0, 0))).toBe('Good morning');
  });
});

describe('greetingName', () => {
  it('prefers displayName over username', () => {
    expect(greetingName('Harbir', 'harbir_b')).toBe('Harbir');
  });

  it('falls back to username when displayName is unset', () => {
    expect(greetingName(null, 'harbir_b')).toBe('harbir_b');
  });

  it('falls back to username when displayName is blank', () => {
    expect(greetingName('   ', 'harbir_b')).toBe('harbir_b');
  });

  it('returns null when neither is set, never falling back to email', () => {
    expect(greetingName(null, null)).toBeNull();
    expect(greetingName(undefined, undefined)).toBeNull();
  });

  it('trims whitespace from a valid displayName', () => {
    expect(greetingName('  Harbir  ', null)).toBe('Harbir');
  });
});
