import { supabase } from '../lib/supabase';
import { fetchAllExerciseRecords, fetchAllOneRepMaxes, fetchAllRepPRs } from './prSummaryQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

function createQueryBuilder(result: Result) {
  const methods = ['select', 'eq', 'order', 'range'] as const;
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
          exercises: {
            name: 'Bench Press',
            muscle_group: 'chest',
            photo_url: 'https://example.com/bench.jpg',
          },
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
        muscleGroup: 'chest',
        exercisePhotoUrl: 'https://example.com/bench.jpg',
      },
    ]);
  });

  it("falls back to 'other' when the exercise join is missing a muscle group", async () => {
    mockTable({
      data: [
        {
          reps: 3,
          best_weight_kg: '100.00',
          source_set_id: 'set-3',
          achieved_at: '2026-01-06T00:00:00Z',
          exercise_id: 'ex-3',
          exercises: null,
        },
      ],
      error: null,
    });

    const result = await fetchAllRepPRs('user-1');

    expect(result[0].muscleGroup).toBe('other');
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
          exercises: { name: 'Squat', photo_url: null },
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
        exercisePhotoUrl: null,
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

describe('fetchAllExerciseRecords', () => {
  it('merges most-reps and longest-time records, most recent first', async () => {
    const tables: Record<string, ReturnType<typeof createQueryBuilder>> = {
      rep_records: createQueryBuilder({
        data: [
          {
            reps: 25,
            source_set_id: 'set-pushup',
            achieved_at: '2026-01-05T00:00:00Z',
            exercise_id: 'ex-pushup',
            exercises: { name: 'Push-Up', photo_url: null },
          },
        ],
        error: null,
      }),
      duration_records: createQueryBuilder({
        data: [
          {
            duration_seconds: 90,
            source_set_id: 'set-plank',
            achieved_at: '2026-02-01T00:00:00Z',
            exercise_id: 'ex-plank',
            exercises: null,
          },
        ],
        error: null,
      }),
    };
    mockFrom.mockImplementation((table: string) => tables[table]);

    const result = await fetchAllExerciseRecords('user-1');

    expect(result).toEqual([
      {
        measurementType: 'timed',
        value: 90,
        sourceSetId: 'set-plank',
        achievedAt: '2026-02-01T00:00:00Z',
        exerciseId: 'ex-plank',
        exerciseName: 'Exercise',
        exercisePhotoUrl: null,
      },
      {
        measurementType: 'bodyweight',
        value: 25,
        sourceSetId: 'set-pushup',
        achievedAt: '2026-01-05T00:00:00Z',
        exerciseId: 'ex-pushup',
        exerciseName: 'Push-Up',
        exercisePhotoUrl: null,
      },
    ]);
    expect(tables.rep_records.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(tables.duration_records.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(fetchAllExerciseRecords('user-1')).rejects.toThrow('boom');
  });
});
