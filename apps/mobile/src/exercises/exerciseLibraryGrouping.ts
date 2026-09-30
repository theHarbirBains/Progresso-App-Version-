import type { ExerciseRow } from './exerciseQueries';

export interface ExerciseLibrarySection {
  letter: string;
  data: ExerciseRow[];
}

/** Section label for a name that doesn't start with a letter -- matches iOS Contacts' own "#" bucket for symbols/numbers. */
export const OTHER_LETTER = '#';

/** Every letter the index rail can show, in a fixed display order -- independent of which ones actually appear in the current filtered result set. */
export const ALPHABET_INDEX_LETTERS = [
  OTHER_LETTER,
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
];

function firstLetterOf(name: string): string {
  const first = name.trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : OTHER_LETTER;
}

/**
 * Groups exercises into per-letter sections for a SectionList, one section
 * per distinct first letter actually present -- the same "iOS Contacts"
 * grouping foodLibraryGrouping.ts already does for the food library. Callers
 * must pass rows already in the order they want each group (and the groups
 * themselves) to appear in -- this only partitions, it never sorts.
 */
export function groupExercisesByLetter(rows: ExerciseRow[]): ExerciseLibrarySection[] {
  const sections: ExerciseLibrarySection[] = [];
  const byLetter = new Map<string, ExerciseLibrarySection>();

  for (const row of rows) {
    const letter = firstLetterOf(row.name);
    const existing = byLetter.get(letter);
    if (existing) {
      existing.data.push(row);
    } else {
      const section: ExerciseLibrarySection = { letter, data: [row] };
      byLetter.set(letter, section);
      sections.push(section);
    }
  }

  return sections;
}
