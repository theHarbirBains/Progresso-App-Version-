import { supabase } from '../lib/supabase';
import { fetchAllOneRepMaxes, fetchAllRepPRs } from './prSummaryQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

function createQueryBuilder(result: Result) {
  const methods = ['select', 'eq', 'order'] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    builder[m] = jest.fn(() => builder);
  }
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

describe('fetchAllRepPRs', () => {
  it('maps rows to camelCase with the joined exercise name, most recent first', async () => {
    mockTable({
      data: [
        {
          reps: 5,
          best_weight_kg: '225.00',
          source_set_id: 'set-1',
          achieved_at: '2026-01-05T00:00:00Z',
          exercise_id: 'ex-1',
          exercises: { name: 'Bench Press' },
        },
      ],
      error: null,
    });

    const result = await fetchAllRepPRs('user-1');

    expect(result).toEqual([
      {
        reps: 5,
        bestWeightKg: 225,
        sourceSetId: 'set-1',
        achievedAt: '2026-01-05T00:00:00Z',
        exerciseId: 'ex-1',
        exerciseName: 'Bench Press',
      },
    ]);
  });

  it('returns an empty array when there are no rep PRs', async () => {
    mockTable({ data: [], error: null });

    await expect(fetchAllRepPRs('user-1')).resolves.toEqual([]);
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(fetchAllRepPRs('user-1')).rejects.toThrow('boom');
  });
});

describe('fetchAllOneRepMaxes', () => {
  it('maps rows to camelCase with the joined exercise name', async () => {
    mockTable({
      data: [
        {
          weight_kg: '245.00',
          source_set_id: 'set-2',
          achieved_at: '2026-02-01T00:00:00Z',
          exercise_id: 'ex-2',
          exercises: { name: 'Squat' },
        },
      ],
      error: null,
    });

    const result = await fetchAllOneRepMaxes('user-1');

    expect(result).toEqual([
      {
        weightKg: 245,
        sourceSetId: 'set-2',
        achievedAt: '2026-02-01T00:00:00Z',
        exerciseId: 'ex-2',
        exerciseName: 'Squat',
      },
    ]);
  });

  it('returns an empty array when there are no one-rep maxes', async () => {
    mockTable({ data: [], error: null });

    await expect(fetchAllOneRepMaxes('user-1')).resolves.toEqual([]);
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(fetchAllOneRepMaxes('user-1')).rejects.toThrow('boom');
  });
});
