import { supabase } from '../lib/supabase';
import { fetchExerciseSetHistory } from './exerciseHistoryQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

// Same chainable-and-thenable mock builder pattern as workoutQueries.test.ts.
function createQueryBuilder(result: Result) {
  const methods = ['select', 'eq', 'is', 'in'] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    builder[m] = jest.fn(() => builder);
  }
  builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function mockTables(byTable: Record<string, Result>) {
  const builders: Record<string, ReturnType<typeof createQueryBuilder>> = {};
  for (const [table, result] of Object.entries(byTable)) {
    builders[table] = createQueryBuilder(result);
  }
  mockFrom.mockImplementation((table: string) => builders[table]);
  return builders;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('fetchExerciseSetHistory', () => {
  it('joins sets to their workout date, sorted chronologically', async () => {
    mockTables({
      workout_exercises: {
        data: [
          {
            id: 'we1',
            workouts: {
              performed_at: '2026-02-01T00:00:00Z',
              completed_at: '2026-02-01T01:00:00Z',
              deleted_at: null,
            },
          },
          {
            id: 'we2',
            workouts: {
              performed_at: '2026-01-01T00:00:00Z',
              completed_at: '2026-01-01T01:00:00Z',
              deleted_at: null,
            },
          },
        ],
        error: null,
      },
      sets: {
        data: [
          { workout_exercise_id: 'we1', weight_kg: '110.00', reps: 8 },
          { workout_exercise_id: 'we2', weight_kg: '100.00', reps: 8 },
        ],
        error: null,
      },
    });

    const result = await fetchExerciseSetHistory('user-1', 'ex-1');

    expect(result).toEqual([
      { weightKg: 100, reps: 8, performedAt: '2026-01-01T00:00:00Z', workoutExerciseId: 'we2' },
      { weightKg: 110, reps: 8, performedAt: '2026-02-01T00:00:00Z', workoutExerciseId: 'we1' },
    ]);
  });

  it('excludes workout_exercises whose workout is not yet completed', async () => {
    mockTables({
      workout_exercises: {
        data: [
          {
            id: 'we-active',
            workouts: {
              performed_at: '2026-01-01T00:00:00Z',
              completed_at: null,
              deleted_at: null,
            },
          },
        ],
        error: null,
      },
      sets: { data: [], error: null },
    });

    const result = await fetchExerciseSetHistory('user-1', 'ex-1');

    expect(result).toEqual([]);
  });

  it('excludes workout_exercises whose workout is soft-deleted', async () => {
    mockTables({
      workout_exercises: {
        data: [
          {
            id: 'we-deleted',
            workouts: {
              performed_at: '2026-01-01T00:00:00Z',
              completed_at: '2026-01-01T01:00:00Z',
              deleted_at: '2026-01-02T00:00:00Z',
            },
          },
        ],
        error: null,
      },
      sets: { data: [], error: null },
    });

    const result = await fetchExerciseSetHistory('user-1', 'ex-1');

    expect(result).toEqual([]);
  });

  it('returns an empty array without querying sets when there are no qualifying workout_exercises', async () => {
    const tables = mockTables({
      workout_exercises: { data: [], error: null },
      sets: { data: [], error: null },
    });

    const result = await fetchExerciseSetHistory('user-1', 'ex-1');

    expect(result).toEqual([]);
    expect(tables.sets.in).not.toHaveBeenCalled();
  });

  it('throws on a workout_exercises query error', async () => {
    mockTables({
      workout_exercises: { data: null, error: { message: 'boom' } },
      sets: { data: [], error: null },
    });

    await expect(fetchExerciseSetHistory('user-1', 'ex-1')).rejects.toThrow('boom');
  });

  it('throws on a sets query error', async () => {
    mockTables({
      workout_exercises: {
        data: [
          {
            id: 'we1',
            workouts: {
              performed_at: '2026-01-01T00:00:00Z',
              completed_at: '2026-01-01T01:00:00Z',
              deleted_at: null,
            },
          },
        ],
        error: null,
      },
      sets: { data: null, error: { message: 'boom' } },
    });

    await expect(fetchExerciseSetHistory('user-1', 'ex-1')).rejects.toThrow('boom');
  });
});
