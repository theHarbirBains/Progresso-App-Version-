import { escapeIlike } from './ilike';

describe('escapeIlike', () => {
  it('leaves a plain search term unchanged', () => {
    expect(escapeIlike('chicken breast')).toBe('chicken breast');
  });

  it('escapes a literal % so it is not treated as a wildcard', () => {
    expect(escapeIlike('100%')).toBe('100\\%');
  });

  it('escapes a literal _ so it is not treated as a single-character wildcard', () => {
    expect(escapeIlike('snack_size')).toBe('snack\\_size');
  });

  it('escapes a literal backslash', () => {
    expect(escapeIlike('a\\b')).toBe('a\\\\b');
  });

  it('escapes every occurrence, not just the first', () => {
    expect(escapeIlike('50%_off_100%')).toBe('50\\%\\_off\\_100\\%');
  });
});
