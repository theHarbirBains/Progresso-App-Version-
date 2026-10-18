import { chunk, fetchAllRows, fetchAllRowsForIds, ID_CHUNK_SIZE, PAGE_SIZE } from './fetchAllRows';

/** A fake table of `total` rows served `cap` at a time, like Supabase's Max rows. */
function serve(total: number, cap: number, { withCount = true } = {}) {
  const rows = Array.from({ length: total }, (_, i) => ({ n: i }));
  const page = jest.fn(async (from: number, to: number) => ({
    data: rows.slice(from, Math.min(to + 1, from + cap)),
    error: null,
    count: withCount ? total : null,
  }));
  return { rows, page };
}

describe('fetchAllRows', () => {
  it('reads a long history in full, a page at a time', async () => {
    const { rows, page } = serve(2500, PAGE_SIZE);

    const result = await fetchAllRows<{ n: number }>(page);

    expect(result).toEqual(rows);
    expect(page.mock.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it('keeps going when the server caps a page below the size asked for', async () => {
    const { rows, page } = serve(1200, 500);

    expect(await fetchAllRows<{ n: number }>(page)).toEqual(rows);
    expect(page).toHaveBeenCalledTimes(3);
  });

  it('reads one page for a short history', async () => {
    const { page } = serve(40, PAGE_SIZE);

    expect(await fetchAllRows(page)).toHaveLength(40);
    expect(page).toHaveBeenCalledTimes(1);
  });

  it('without a total, stops at the first short page', async () => {
    const { page } = serve(1500, PAGE_SIZE, { withCount: false });

    expect(await fetchAllRows(page)).toHaveLength(1500);
    expect(page).toHaveBeenCalledTimes(2);
  });

  it('throws when a page fails', async () => {
    const page = jest.fn(async () => ({ data: null, error: { message: 'boom' }, count: null }));

    await expect(fetchAllRows(page)).rejects.toThrow('boom');
  });
});

describe('fetchAllRowsForIds', () => {
  it('splits a long id list so no request carries more than ID_CHUNK_SIZE ids, keeping their order', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const page = jest.fn(async (group: string[]) => ({
      data: group.map((id) => ({ id })),
      error: null,
      count: group.length,
    }));

    const result = await fetchAllRowsForIds<{ id: string }>(ids, page);

    expect(result.map((row) => row.id)).toEqual(ids);
    expect(page).toHaveBeenCalledTimes(3);
    for (const [group] of page.mock.calls) {
      expect(group.length).toBeLessThanOrEqual(ID_CHUNK_SIZE);
    }
  });

  it('makes no request for no ids', async () => {
    const page = jest.fn();

    expect(await fetchAllRowsForIds([], page)).toEqual([]);
    expect(page).not.toHaveBeenCalled();
  });
});

describe('chunk', () => {
  it('groups items in order, the last group holding the rest', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
