import {
  ALPHABET_INDEX_LETTERS,
  compareByName,
  groupByFirstLetter,
  OTHER_LETTER,
} from './alphabeticalGrouping';

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

describe('compareByName', () => {
  it('sorts A to Z ignoring case, with numbers, symbols and accented initials together first', () => {
    const names = [
      'banana',
      'Éclair',
      'Apple',
      '10 Grain Bread',
      'apple pie',
      'Cherry',
      '#1 Combo',
    ];

    const sorted = [...names].sort(compareByName);

    expect(sorted.slice(3)).toEqual(['Apple', 'apple pie', 'banana', 'Cherry']);
    expect(new Set(sorted.slice(0, 3))).toEqual(new Set(['Éclair', '10 Grain Bread', '#1 Combo']));
    // So the "#" section is always one block.
    const sections = groupByFirstLetter(sorted, (name) => name).map((s) => s.letter);
    expect(sections).toEqual([OTHER_LETTER, 'A', 'B', 'C']);
  });

  it('ignores leading spaces', () => {
    expect(compareByName('  apple', 'Banana')).toBeLessThan(0);
  });
});
