import type { FoodRow } from './foodQueries';
import { ALPHABET_INDEX_LETTERS, groupFoodsByLetter, OTHER_LETTER } from './foodLibraryGrouping';

function food(name: string, id = name): FoodRow {
  return {
    id,
    name,
    brand: null,
    barcode: null,
    imageUrl: null,
    servingSize: 100,
    servingUnit: 'g',
    calories: 100,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    isActive: true,
  };
}

describe('ALPHABET_INDEX_LETTERS', () => {
  it('is "#" followed by A-Z, 27 entries total', () => {
    expect(ALPHABET_INDEX_LETTERS).toHaveLength(27);
    expect(ALPHABET_INDEX_LETTERS[0]).toBe('#');
    expect(ALPHABET_INDEX_LETTERS[1]).toBe('A');
    expect(ALPHABET_INDEX_LETTERS[26]).toBe('Z');
  });
});

describe('groupFoodsByLetter', () => {
  it('groups foods under their first letter, uppercased', () => {
    const rows = [food('apple'), food('Avocado'), food('Banana')];

    const sections = groupFoodsByLetter(rows);

    expect(sections).toEqual([
      { letter: 'A', data: [rows[0], rows[1]] },
      { letter: 'B', data: [rows[2]] },
    ]);
  });

  it("preserves each food's own position within its letter group (does not re-sort)", () => {
    // Deliberately not alphabetical within the letter -- grouping must not
    // reorder, only partition; the caller is responsible for pre-sorting.
    const rows = [food('Zebra Cake'), food('Apricot'), food('Zucchini')];

    const sections = groupFoodsByLetter(rows);

    expect(sections).toEqual([
      { letter: 'Z', data: [rows[0], rows[2]] },
      { letter: 'A', data: [rows[1]] },
    ]);
  });

  it('groups a name starting with a digit or symbol under "#"', () => {
    const rows = [food('7-Eleven Slurpee'), food('#1 Protein Bar')];

    const sections = groupFoodsByLetter(rows);

    expect(sections).toEqual([{ letter: OTHER_LETTER, data: [rows[0], rows[1]] }]);
  });

  it('ignores leading whitespace when determining the first letter', () => {
    const rows = [food('  Melon')];

    const sections = groupFoodsByLetter(rows);

    expect(sections[0]!.letter).toBe('M');
  });

  it('returns no sections for an empty list', () => {
    expect(groupFoodsByLetter([])).toEqual([]);
  });

  it('produces one section per letter even when every food shares it', () => {
    const rows = [food('Chicken Breast'), food('Chicken Thigh'), food('Cheese')];

    const sections = groupFoodsByLetter(rows);

    expect(sections).toHaveLength(1);
    expect(sections[0]!.data).toHaveLength(3);
  });
});
