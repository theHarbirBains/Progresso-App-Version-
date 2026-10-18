// Reading "everything" from Supabase in pieces the API will actually return.
//
// Supabase answers any one request with at most its "Max rows" API setting
// (1,000 by default) and says nothing about the rest, so a query for a whole
// history silently stops at that many rows. And a `.in()` filter puts every
// id in the request URL (about 37 characters each), which a gateway refuses
// past a few hundred. So whole-history loads page through results and split
// long id lists.

/** Rows asked for per request -- Supabase's default cap. */
export const PAGE_SIZE = 1000;
/** Ids per `.in()` filter, so a request URL stays a few kilobytes long. */
export const ID_CHUNK_SIZE = 100;
/** Chunks read at once. */
const CHUNK_CONCURRENCY = 4;

// A Supabase query builder awaited for one page; the rows' shape is the caller's to name.
type PageResult = PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
  count?: number | null;
}>;

/**
 * Every row a query matches, a page at a time. `page(from, to)` builds the query for
 * rows `from` to `to` (inclusive, as `.range()` takes them), with a stable order and
 * `{ count: 'exact' }` on its select: knowing the total from the first page means a
 * server cap below PAGE_SIZE can't end the loop early. Without a total it stops at the
 * first short page.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PageResult,
): Promise<T[]> {
  const rows: unknown[] = [];
  let total: number | null = null;
  for (;;) {
    const { data, error, count } = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (typeof count === 'number') total = count;
    const done =
      batch.length === 0 || (total !== null ? rows.length >= total : batch.length < PAGE_SIZE);
    if (done) return rows as T[];
  }
}

/** `items` in consecutive groups of at most `size`. */
export function chunk<T>(items: T[], size: number = ID_CHUNK_SIZE): T[][] {
  const groups: T[][] = [];
  for (let i = 0; i < items.length; i += size) groups.push(items.slice(i, i + size));
  return groups;
}

/**
 * fetchAllRows for a query filtered by a long id list: the ids in chunks of
 * ID_CHUNK_SIZE, each chunk paged, a few chunks at a time, the rows combined in chunk
 * order.
 */
export async function fetchAllRowsForIds<T>(
  ids: string[],
  page: (ids: string[], from: number, to: number) => PageResult,
): Promise<T[]> {
  const groups = chunk(ids);
  const results: T[][] = new Array(groups.length);
  for (let start = 0; start < groups.length; start += CHUNK_CONCURRENCY) {
    const batch = groups.slice(start, start + CHUNK_CONCURRENCY);
    const rows = await Promise.all(
      batch.map((group) => fetchAllRows<T>((from, to) => page(group, from, to))),
    );
    rows.forEach((groupRows, i) => {
      results[start + i] = groupRows;
    });
  }
  return results.flat();
}
