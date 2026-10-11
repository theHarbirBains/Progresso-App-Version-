import { ALPHABET_INDEX_LETTERS, groupByFirstLetter, OTHER_LETTER } from './alphabeticalGrouping';

describe('ALPHABET_INDEX_LETTERS', () => {
  it('is "#" followed by A-Z, 27 entries total', () => {
    expect(ALPHABET_INDEX_LETTERS).toHaveLength(27);
    expect(ALPHABET_INDEX_LETTERS[0]).toBe(OTHER_LETTER);
    expect(ALPHABET_INDEX_LETTERS[1]).toBe('A');
    expect(ALPHABET_INDEX_LETTERS[26]).toBe('Z');
  });
});

describe('groupByFirstLetter', () => {
  const nameOf = (row: { name: string }) => row.name;

  it('groups rows under their first letter, uppercased', () => {
    const rows = [{ name: 'apple' }, { name: 'Avocado' }, { name: 'Banana' }];

    expect(groupByFirstLetter(rows, nameOf)).toEqual([
      { letter: 'A', data: [rows[0], rows[1]] },
      { letter: 'B', data: [rows[2]] },
    ]);
  });

  it("preserves each row's own position within its letter group (does not re-sort)", () => {
    const rows = [{ name: 'Zebra' }, { name: 'Apricot' }, { name: 'Zucchini' }];

    expect(groupByFirstLetter(rows, nameOf)).toEqual([
      { letter: 'Z', data: [rows[0], rows[2]] },
      { letter: 'A', data: [rows[1]] },
    ]);
  });

  it('groups a name starting with a digit or symbol under the "other" bucket', () => {
    const rows = [{ name: '7-Eleven Slurpee' }, { name: '#1 Protein Bar' }];

    expect(groupByFirstLetter(rows, nameOf)).toEqual([
      { letter: OTHER_LETTER, data: [rows[0], rows[1]] },
    ]);
  });

  it('ignores leading whitespace when determining the first letter', () => {
    const rows = [{ name: '  Melon' }];

    expect(groupByFirstLetter(rows, nameOf)[0]!.letter).toBe('M');
  });

  it('returns no sections for an empty list', () => {
    expect(groupByFirstLetter([], nameOf)).toEqual([]);
  });
});
