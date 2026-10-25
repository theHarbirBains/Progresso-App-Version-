// Groups any list of named rows into per-letter sections for a SectionList --
// one section per distinct first letter actually present, in the order the
// rows were given (this only partitions, it never sorts -- callers pass rows
// already in the order they want each group, and the groups themselves, to
// appear in). "Other" bucket for anything that doesn't start with A-Z,
// matching iOS Contacts' own "#" bucket for symbols/numbers.
//
// Shared by exerciseLibraryGrouping.ts and foodLibraryGrouping.ts, which
// previously each hand-rolled an identical copy of this -- same OTHER_LETTER,
// same ALPHABET_INDEX_LETTERS computation, same firstLetterOf/grouping logic,
// differing only in the row type's name. Each of those files still owns its
// own domain-specific type names (ExerciseLibrarySection/FoodLibrarySection)
// and function names, so no call site anywhere needed to change.

/** Section label for a name that doesn't start with a letter -- matches iOS Contacts' own "#" bucket for symbols/numbers. */
export const OTHER_LETTER = '#';

/** Every letter an index rail can show, in a fixed display order -- independent of which ones actually appear in the current filtered result set. */
export const ALPHABET_INDEX_LETTERS = [
  OTHER_LETTER,
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
];

function firstLetterOf(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : OTHER_LETTER;
}

/**
 * A to Z ignoring case ("apple" beside "Apple", never after "Zucchini"), with every name that
 * groups under OTHER_LETTER -- a number, a symbol -- together ahead of the letters: the order
 * groupByFirstLetter's sections read in, so its "#" section is always one block.
 */
export function compareByName(a: string, b: string): number {
  const otherA = firstLetterOf(a) === OTHER_LETTER;
  const otherB = firstLetterOf(b) === OTHER_LETTER;
  if (otherA !== otherB) return otherA ? -1 : 1;
  return a.trim().localeCompare(b.trim(), undefined, { sensitivity: 'base' });
}

export interface LetterSection<T> {
  letter: string;
  data: T[];
}

export function groupByFirstLetter<T>(rows: T[], nameOf: (row: T) => string): LetterSection<T>[] {
  const sections: LetterSection<T>[] = [];
  const byLetter = new Map<string, LetterSection<T>>();

  for (const row of rows) {
    const letter = firstLetterOf(nameOf(row));
    const existing = byLetter.get(letter);
    if (existing) {
      existing.data.push(row);
    } else {
      const section: LetterSection<T> = { letter, data: [row] };
      byLetter.set(letter, section);
      sections.push(section);
    }
  }

  return sections;
}
