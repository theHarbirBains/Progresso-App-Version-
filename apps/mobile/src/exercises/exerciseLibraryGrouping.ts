import { groupByFirstLetter, OTHER_LETTER } from '../lib/alphabeticalGrouping';
import type { ExerciseRow } from './exerciseQueries';

export { OTHER_LETTER };

export interface ExerciseLibrarySection {
  letter: string;
  data: ExerciseRow[];
}

/**
 * Groups exercises into per-letter sections for a SectionList, one section
 * per distinct first letter actually present -- the same "iOS Contacts"
 * grouping foodLibraryGrouping.ts already does for the food library (see
 * lib/alphabeticalGrouping.ts, shared by both). Callers must pass rows
 * already in the order they want each group (and the groups themselves) to
 * appear in -- this only partitions, it never sorts.
 */
export function groupExercisesByLetter(rows: ExerciseRow[]): ExerciseLibrarySection[] {
  return groupByFirstLetter(rows, (row) => row.name);
}
