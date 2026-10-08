import { supabase } from '../lib/supabase';
import {
  fetchAllExercises,
  fetchExerciseSourceCounts,
  fetchExercises,
  invalidateExerciseCache,
} from './exerciseQueries';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder: Record<string, any> = {};
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
  // Thenable at any point in the chain too, matching real
  // PostgrestFilterBuilder -- fetchAllExercises never calls .range(), it
  // just awaits the query directly after .order().
  builder.then = (resolve: (v: MockResult) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
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
  // fetchAllExercises/fetchExerciseSourceCounts share a per-user cache that outlives a
  // single test otherwise (see exerciseQueries.ts) -- clear it for every userId any test
  // below uses, so each test starts from a cold cache regardless of run order.
  invalidateExerciseCache('user-1');
  invalidateExerciseCache('user-2');
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

// fetchAllExercises and fetchExerciseSourceCounts both read a per-user cache of every
// active exercise, fetched unfiltered (no search/muscle-group/source/pagination) and
// filtered/derived in memory -- see exerciseQueries.ts's own comment on why: built-ins
// never change, and a user's own customs only change through an explicit invalidation
// call, so the same cached list can serve every picker/library open in a session with
// at most one real query.
const customBenchPress = {
  id: 'ex-mine',
  name: 'My Bench Press Variant',
  muscle_group: 'chest',
  movement_type: 'bilateral',
  logging_style: null,
  photo_url: null,
  is_active: true,
  created_by: 'user-1',
};
const builtinSquat = {
  id: 'ex-builtin',
  name: 'Barbell Back Squat',
  muscle_group: 'quadriceps',
  movement_type: 'bilateral',
  logging_style: null,
  photo_url: null,
  is_active: true,
  created_by: null,
};

describe('fetchAllExercises', () => {
  const allParams = { userId: 'user-1', search: '', muscleGroup: null, source: 'all' as const };

  it('fetches every active exercise unfiltered -- no search/muscle-group/source/range at all', async () => {
    const calls = mockQueryBuilder({ data: [builtinSquat, customBenchPress], error: null });

    await fetchAllExercises(allParams);

    expect(mockFrom).toHaveBeenCalledWith('exercises');
    expect(calls.eq).toEqual([['is_active', true]]);
    expect(calls.order).toEqual([['name', { ascending: true }]]);
    expect(calls.ilike).toEqual([]);
    expect(calls.is).toEqual([]);
    expect(calls.range).toEqual([]);
  });

  it('applies search/muscle-group/source filters in memory, over the one fetched list', async () => {
    mockQueryBuilder({ data: [builtinSquat, customBenchPress], error: null });

    const bySearch = await fetchAllExercises({ ...allParams, search: 'bench' });
    const byMuscleGroup = await fetchAllExercises({ ...allParams, muscleGroup: 'quadriceps' });
    const builtinOnly = await fetchAllExercises({ ...allParams, source: 'builtin' });
    const mineOnly = await fetchAllExercises({ ...allParams, source: 'mine' });

    expect(bySearch.map((r) => r.id)).toEqual(['ex-mine']);
    expect(byMuscleGroup.map((r) => r.id)).toEqual(['ex-builtin']);
    expect(builtinOnly.map((r) => r.id)).toEqual(['ex-builtin']);
    expect(mineOnly.map((r) => r.id)).toEqual(['ex-mine']);
    // All four were answered from the one cached fetch above -- no further query.
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('reverses the already-ascending cached order for a descending request', async () => {
    mockQueryBuilder({ data: [builtinSquat, customBenchPress], error: null });

    const result = await fetchAllExercises({ ...allParams, ascending: false });

    expect(result.map((r) => r.id)).toEqual(['ex-mine', 'ex-builtin']);
  });

  it('fetches once per user, then serves every later call from the cache', async () => {
    mockQueryBuilder({ data: [builtinSquat], error: null });

    await fetchAllExercises(allParams);
    await fetchAllExercises({ ...allParams, search: 'squat' });
    await fetchAllExercises({ ...allParams, muscleGroup: 'quadriceps' });

    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('fetches again for a different user -- the cache is per user, not shared', async () => {
    mockQueryBuilder({ data: [builtinSquat], error: null });

    await fetchAllExercises(allParams);
    await fetchAllExercises({ ...allParams, userId: 'user-2' });

    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it('fetches fresh again after invalidateExerciseCache, as after a create/edit/delete', async () => {
    mockQueryBuilder({ data: [builtinSquat], error: null });
    await fetchAllExercises(allParams);

    invalidateExerciseCache('user-1');
    mockQueryBuilder({ data: [builtinSquat, customBenchPress], error: null });
    const result = await fetchAllExercises(allParams);

    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });

  it('maps every returned row, with no truncation', async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      id: `ex-${i}`,
      name: `Exercise ${i}`,
      muscle_group: 'chest',
      movement_type: 'bilateral',
      logging_style: null,
      photo_url: null,
      is_active: true,
      created_by: null,
    }));
    mockQueryBuilder({ data: rows, error: null });

    const result = await fetchAllExercises(allParams);

    expect(result).toHaveLength(50);
  });

  it('throws when the query returns an error, and does not cache the failure', async () => {
    mockQueryBuilder({ data: null, error: { message: 'network error' } });

    await expect(fetchAllExercises(allParams)).rejects.toThrow('network error');

    mockQueryBuilder({ data: [builtinSquat], error: null });
    await expect(fetchAllExercises(allParams)).resolves.toHaveLength(1);
  });
});

describe('fetchExerciseSourceCounts', () => {
  it('derives each source count from the cached list, with one query, not three', async () => {
    mockQueryBuilder({ data: [builtinSquat, customBenchPress], error: null });

    const result = await fetchExerciseSourceCounts('user-1');

    expect(result).toEqual({ all: 2, builtin: 1, mine: 1 });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('shares its cache with fetchAllExercises -- asking either first costs the only query', async () => {
    mockQueryBuilder({ data: [builtinSquat, customBenchPress], error: null });

    await fetchAllExercises({ userId: 'user-1', search: '', muscleGroup: null, source: 'all' });
    const counts = await fetchExerciseSourceCounts('user-1');

    expect(counts).toEqual({ all: 2, builtin: 1, mine: 1 });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('throws when the underlying query errors', async () => {
    mockQueryBuilder({ data: null, error: { message: 'network error' } });

    await expect(fetchExerciseSourceCounts('user-1')).rejects.toThrow('network error');
  });
});
