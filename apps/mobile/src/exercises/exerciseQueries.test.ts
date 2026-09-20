import { supabase } from '../lib/supabase';
import { fetchExerciseSourceCounts, fetchExercises } from './exerciseQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface MockResult {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
  count?: number | null;
}

function mockQueryBuilder(result: MockResult) {
  const calls: Record<string, unknown[][]> = {
    select: [],
    eq: [],
    ilike: [],
    is: [],
    order: [],
    range: [],
  };
  // Every filter method returns the same builder so chaining works
  // regardless of call order, matching @supabase/supabase-js's real
  // PostgrestFilterBuilder shape closely enough for these tests. range()
  // is always the last call in exerciseQueries, so it resolves directly.
  const builder: Record<string, jest.Mock> = {};
  for (const method of ['select', 'eq', 'ilike', 'is', 'order'] as const) {
    builder[method] = jest.fn((...args: unknown[]) => {
      calls[method].push(args);
      return builder;
    });
  }
  builder.range = jest.fn((...args: unknown[]) => {
    calls.range.push(args);
    return Promise.resolve(result);
  });
  mockFrom.mockReturnValue(builder);
  return calls;
}

const baseParams = {
  userId: 'user-1',
  search: '',
  muscleGroup: null,
  source: 'all' as const,
  page: 0,
  pageSize: 20,
};

beforeEach(() => {
  mockFrom.mockReset();
});

describe('fetchExercises', () => {
  it('queries active exercises ordered by name with no extra filters by default', async () => {
    const calls = mockQueryBuilder({ data: [], error: null });

    await fetchExercises(baseParams);

    expect(mockFrom).toHaveBeenCalledWith('exercises');
    expect(calls.eq).toEqual([['is_active', true]]);
    expect(calls.order).toEqual([['name', { ascending: true }]]);
    expect(calls.ilike).toEqual([]);
    expect(calls.is).toEqual([]);
    expect(calls.range).toEqual([[0, 19]]);
  });

  it('applies a name search filter when search text is provided', async () => {
    const calls = mockQueryBuilder({ data: [], error: null });

    await fetchExercises({ ...baseParams, search: '  bench  ' });

    expect(calls.ilike).toEqual([['name', '%bench%']]);
  });

  it('does not apply a search filter for blank/whitespace-only input', async () => {
    const calls = mockQueryBuilder({ data: [], error: null });

    await fetchExercises({ ...baseParams, search: '   ' });

    expect(calls.ilike).toEqual([]);
  });

  it('applies a muscle group filter when provided', async () => {
    const calls = mockQueryBuilder({ data: [], error: null });

    await fetchExercises({ ...baseParams, muscleGroup: 'chest' });

    expect(calls.eq).toContainEqual(['muscle_group', 'chest']);
  });

  it("filters to built-ins only (created_by is null) for source 'builtin'", async () => {
    const calls = mockQueryBuilder({ data: [], error: null });

    await fetchExercises({ ...baseParams, source: 'builtin' });

    expect(calls.is).toEqual([['created_by', null]]);
  });

  it("filters to the user's own exercises for source 'mine'", async () => {
    const calls = mockQueryBuilder({ data: [], error: null });

    await fetchExercises({ ...baseParams, source: 'mine' });

    expect(calls.eq).toContainEqual(['created_by', 'user-1']);
  });

  it('computes the correct range for a given page/pageSize', async () => {
    const calls = mockQueryBuilder({ data: [], error: null });

    await fetchExercises({ ...baseParams, page: 2, pageSize: 20 });

    expect(calls.range).toEqual([[40, 59]]);
  });

  it('reports hasMore=true when a full page is returned', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: `ex-${i}`,
      name: `Exercise ${i}`,
      muscle_group: 'chest',
      is_active: true,
      created_by: null,
    }));
    mockQueryBuilder({ data: rows, error: null });

    const result = await fetchExercises(baseParams);

    expect(result.hasMore).toBe(true);
    expect(result.rows).toHaveLength(20);
  });

  it('reports hasMore=false when fewer than a full page is returned', async () => {
    mockQueryBuilder({
      data: [
        { id: 'ex-1', name: 'Push-Up', muscle_group: 'chest', is_active: true, created_by: null },
      ],
      error: null,
    });

    const result = await fetchExercises(baseParams);

    expect(result.hasMore).toBe(false);
  });

  it('maps snake_case db rows to camelCase ExerciseRow', async () => {
    mockQueryBuilder({
      data: [
        {
          id: 'ex-1',
          name: 'Barbell Curl',
          muscle_group: 'biceps',
          is_active: true,
          created_by: 'user-1',
        },
      ],
      error: null,
    });

    const result = await fetchExercises(baseParams);

    expect(result.rows).toEqual([
      {
        id: 'ex-1',
        name: 'Barbell Curl',
        muscleGroup: 'biceps',
        isActive: true,
        createdBy: 'user-1',
      },
    ]);
  });

  it('throws when the query returns an error', async () => {
    mockQueryBuilder({ data: null, error: { message: 'network error' } });

    await expect(fetchExercises(baseParams)).rejects.toThrow('network error');
  });

  it('passes ascending through to the order clause (defaults to true when omitted)', async () => {
    const calls = mockQueryBuilder({ data: [], error: null });

    await fetchExercises({ ...baseParams, ascending: false });

    expect(calls.order).toEqual([['name', { ascending: false }]]);
  });

  it('returns the exact total count from the query, not the page size', async () => {
    mockQueryBuilder({ data: [{ id: 'ex-1', name: 'Push-Up' }], error: null, count: 328 });

    const result = await fetchExercises(baseParams);

    expect(result.totalCount).toBe(328);
  });

  it('falls back to the returned row count if the query reports no count', async () => {
    mockQueryBuilder({ data: [{ id: 'ex-1', name: 'Push-Up' }], error: null });

    const result = await fetchExercises(baseParams);

    expect(result.totalCount).toBe(1);
  });
});

// A thenable, infinitely-chainable stand-in for Supabase's
// PostgrestFilterBuilder. fetchExerciseSourceCounts fires its three count
// queries concurrently (Promise.all), each via its own supabase.from(...)
// call -- so mockFrom builds a FRESH, independent builder per call (via
// mockImplementation, not a single shared mockReturnValue), each one
// tracking which filter it saw and resolving to that source's own result.
// A single shared builder object would race: all three call chains would
// mutate the same "current source" flag before any of them actually
// resolved, so every query would resolve to whichever ran last.
function mockCountQueryBuilder(results: Record<'all' | 'builtin' | 'mine', MockResult>) {
  mockFrom.mockImplementation(() => {
    let source: 'all' | 'builtin' | 'mine' = 'all';
    interface Builder {
      select: jest.Mock;
      eq: jest.Mock;
      is: jest.Mock;
      then: (resolve: (v: unknown) => void) => void;
    }
    const builder: Builder = {
      select: jest.fn(() => builder),
      eq: jest.fn((column: string) => {
        if (column === 'created_by') source = 'mine';
        return builder;
      }),
      is: jest.fn(() => {
        source = 'builtin';
        return builder;
      }),
      then: (resolve: (v: unknown) => void) => resolve(results[source]),
    };
    return builder;
  });
}

describe('fetchExerciseSourceCounts', () => {
  it('returns the real, independent count for each source', async () => {
    mockCountQueryBuilder({
      all: { data: null, error: null, count: 328 },
      builtin: { data: null, error: null, count: 245 },
      mine: { data: null, error: null, count: 12 },
    });

    const result = await fetchExerciseSourceCounts('user-1');

    expect(result).toEqual({ all: 328, builtin: 245, mine: 12 });
  });

  it('throws when any of the three count queries errors', async () => {
    mockCountQueryBuilder({
      all: { data: null, error: null, count: 328 },
      builtin: { data: null, error: { message: 'network error' }, count: null },
      mine: { data: null, error: null, count: 12 },
    });

    await expect(fetchExerciseSourceCounts('user-1')).rejects.toThrow('network error');
  });
});
