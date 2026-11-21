// Drop sets (explicitly requested): a working set followed by drops -- the weight dropped and the
// set carried on, as many times as the person likes. The drops are part of that set: shown under
// it with no number of their own, their volume counted, never a set count, a record or a top set
// (`sets.is_drop`, 20261207100000_drop_sets.sql). Pure, so the live workout and Log/Edit Past
// Workout place and number them the same way.

/** One logical set in an exercise's order: a set, or a unilateral set's two sides together. */
export interface DropSetRow {
  setIndex: number;
  /** The rows behind it -- one, or a unilateral set's left and right. */
  ids: string[];
  isWarmup?: boolean;
  isDrop?: boolean;
  /** Whether it holds what its exercise records (saved, or typed and about to be). */
  filled: boolean;
}

/** Where a new drop set goes, and the sets that move down one to make room for it. */
export interface DropSetSlot {
  setIndex: number;
  moves: { id: string; setIndex: number }[];
}

/**
 * Where Drop Set puts a new drop: right under the last set filled in -- the set just done -- and
 * under any drops already beneath it, so drops stack (100 -> 75 -> 50). A set waiting empty below
 * (as a guided workout adds the next by itself) moves down one, and so does everything after it.
 * Null when no working set is filled in yet: a drop needs a set to drop from (a warm-up isn't one).
 * `rows` must be in their exercise's order.
 */
export function dropSetSlot(rows: DropSetRow[]): DropSetSlot | null {
  let anchor = -1;
  rows.forEach((row, position) => {
    if (row.filled && !row.isWarmup) anchor = position;
  });
  if (anchor < 0) return null;
  // Past the drops already under it.
  while (rows[anchor + 1]?.isDrop) anchor += 1;
  const setIndex = rows[anchor].setIndex + 1;
  const later = rows.slice(anchor + 1);
  // Only when the next slot is taken does anything move -- a gap left by a removed set will do.
  const moves =
    later[0]?.setIndex === setIndex
      ? later.flatMap((row) => row.ids.map((id) => ({ id, setIndex: row.setIndex + 1 })))
      : [];
  return { setIndex, moves };
}

/** How a row is shown: its set's number, and whether it's a drop under that set. */
export interface SetLabel {
  /** The working set's number -- for a drop, the number of the set it drops from. */
  number: number;
  drop: boolean;
}

/**
 * Each row's label, in order: working sets (warm-ups included) are numbered 1, 2, 3 by position,
 * so removing one never leaves a gap; a drop takes the number of the set above it and no number of
 * its own.
 */
export function setLabels(rows: { isDrop?: boolean }[]): SetLabel[] {
  let number = 0;
  return rows.map((row) => {
    if (row.isDrop) return { number: Math.max(number, 1), drop: true };
    number += 1;
    return { number, drop: false };
  });
}

/**
 * The rows to remove with a set: the set itself and, for a working set, the drops under it -- a
 * drop is part of its set, so it never outlives it. `rows` must be in their exercise's order.
 */
export function rowsRemovedWith<T extends { isDrop?: boolean }>(rows: T[], position: number): T[] {
  const removed = [rows[position]];
  if (rows[position]?.isDrop) return removed;
  for (let next = position + 1; rows[next]?.isDrop; next += 1) removed.push(rows[next]);
  return removed;
}
