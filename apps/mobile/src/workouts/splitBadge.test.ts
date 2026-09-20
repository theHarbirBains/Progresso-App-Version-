import { splitBadgeText } from './splitBadge';

describe('splitBadgeText', () => {
  it('builds initials from a multi-word, slash-separated name', () => {
    expect(splitBadgeText('Push / Pull / Legs')).toBe('PPL');
  });

  it('builds initials from a plain space-separated name', () => {
    expect(splitBadgeText('Upper Lower')).toBe('UL');
  });

  it('shows a single-word name as-is, uppercased', () => {
    expect(splitBadgeText('ppl')).toBe('PPL');
  });

  it('truncates a long single word to 4 characters', () => {
    expect(splitBadgeText('Hypertrophy')).toBe('HYPE');
  });

  it('caps multi-word initials at 4 characters', () => {
    expect(splitBadgeText('Push Pull Legs Upper Lower')).toBe('PPLU');
  });

  it('returns an empty string for a blank name', () => {
    expect(splitBadgeText('   ')).toBe('');
  });
});
