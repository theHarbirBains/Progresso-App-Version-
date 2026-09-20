import type { FoodRow } from './foodQueries';

export interface FoodLibrarySection {
  letter: string;
  data: FoodRow[];
}

/** Section label for a name that doesn't start with a letter -- matches iOS Contacts' own "#" bucket for symbols/numbers. */
export const OTHER_LETTER = '#';

/** Every letter the index rail can show, in a fixed display order -- independent of which ones the user's own foods actually populate. */
export const ALPHABET_INDEX_LETTERS = [
  OTHER_LETTER,
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
];

function firstLetterOf(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : OTHER_LETTER;
}

/**
 * Groups foods into per-letter sections for a SectionList, one section per
 * distinct first letter actually present. Callers must pass rows already in
 * the order they want each group (and the groups themselves) to appear in --
 * this only partitions, it never sorts, so it works the same whether the
 * input is ascending or descending.
 */
export function groupFoodsByLetter(rows: FoodRow[]): FoodLibrarySection[] {
  const sections: FoodLibrarySection[] = [];
  const byLetter = new Map<string, FoodLibrarySection>();

  for (const row of rows) {
    const letter = firstLetterOf(row.name);
    const existing = byLetter.get(letter);
    if (existing) {
      existing.data.push(row);
    } else {
      const section: FoodLibrarySection = { letter, data: [row] };
      byLetter.set(letter, section);
      sections.push(section);
    }
  }

  return sections;
}
