import {
  ALPHABET_INDEX_LETTERS,
  groupByFirstLetter,
  OTHER_LETTER,
} from '../lib/alphabeticalGrouping';
import type { FoodRow } from './foodQueries';

export { ALPHABET_INDEX_LETTERS, OTHER_LETTER };

export interface FoodLibrarySection {
  letter: string;
  data: FoodRow[];
}

/**
 * Groups foods into per-letter sections for a SectionList, one section per
 * distinct first letter actually present (see lib/alphabeticalGrouping.ts,
 * shared with exerciseLibraryGrouping.ts's identical need). Callers must
 * pass rows already in the order they want each group (and the groups
 * themselves) to appear in -- this only partitions, it never sorts, so it
 * works the same whether the input is ascending or descending.
 */
export function groupFoodsByLetter(rows: FoodRow[]): FoodLibrarySection[] {
  return groupByFirstLetter(rows, (row) => row.name);
}
