import { supabase } from '../lib/supabase';
import { fetchOneRepMax, fetchRepPRs } from './prQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

// Same chainable-and-thenable mock builder pattern as workoutQueries.test.ts.
function createQueryBuilder(result: Result) {
  const methods = ['select', 'eq', 'order'] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    builder[m] = jest.fn(() => builder);
  }
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function mockTable(result: Result) {
  const builder = createQueryBuilder(result);
  mockFrom.mockImplementation(() => builder);
  return builder;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('fetchRepPRs', () => {
  it('maps rows to camelCase, ordered by reps', async () => {
    mockTable({
      data: [
        {
          reps: 5,
          best_weight_kg: '110.00',
          source_set_id: 'set-5',
          achieved_at: '2026-01-01T00:00:00Z',
        },
        {
          reps: 8,
          best_weight_kg: '150.00',
          source_set_id: 'set-8',
          achieved_at: '2026-01-02T00:00:00Z',
        },
      ],
      error: null,
    });

    const result = await fetchRepPRs('user-1', 'ex-1');

    expect(result).toEqual([
      { reps: 5, bestWeightKg: 110, sourceSetId: 'set-5', achievedAt: '2026-01-01T00:00:00Z' },
      { reps: 8, bestWeightKg: 150, sourceSetId: 'set-8', achievedAt: '2026-01-02T00:00:00Z' },
    ]);
  });

  it('returns an empty array when there are no rep PRs', async () => {
    mockTable({ data: [], error: null });

    await expect(fetchRepPRs('user-1', 'ex-1')).resolves.toEqual([]);
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(fetchRepPRs('user-1', 'ex-1')).rejects.toThrow('boom');
  });
});

describe('fetchOneRepMax', () => {
  it('maps the row to camelCase when a true 1RM exists', async () => {
    mockTable({
      data: { weight_kg: '225.00', source_set_id: 'set-1', achieved_at: '2026-01-01T00:00:00Z' },
      error: null,
    });

    const result = await fetchOneRepMax('user-1', 'ex-1');

    expect(result).toEqual({
      weightKg: 225,
      sourceSetId: 'set-1',
      achievedAt: '2026-01-01T00:00:00Z',
    });
  });

  it('returns null when no 1-rep set has ever been logged', async () => {
    mockTable({ data: null, error: null });

    await expect(fetchOneRepMax('user-1', 'ex-1')).resolves.toBeNull();
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(fetchOneRepMax('user-1', 'ex-1')).rejects.toThrow('boom');
  });
});
