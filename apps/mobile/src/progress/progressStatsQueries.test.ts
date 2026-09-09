import { supabase } from '../lib/supabase';
import { fetchAllCompletedWorkouts, fetchWorkoutIdForSet } from './progressStatsQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

function createQueryBuilder(result: Result) {
  const methods = ['select', 'eq', 'is', 'not', 'order', 'maybeSingle'] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    builder[m] = jest.fn(() => builder);
  }
  builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('fetchAllCompletedWorkouts', () => {
  it('maps every completed workout, oldest first', async () => {
    mockFrom.mockReturnValue(
      createQueryBuilder({
        data: [
          {
            id: 'w1',
            name: 'Push Day',
            performed_at: '2026-01-01T00:00:00Z',
            completed_at: '2026-01-01T01:00:00Z',
            workout_split_day_id: 'day-1',
          },
        ],
        error: null,
      }),
    );

    const result = await fetchAllCompletedWorkouts('user-1');

    expect(result).toEqual([
      {
        id: 'w1',
        name: 'Push Day',
        performedAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-01T01:00:00Z',
        workoutSplitDayId: 'day-1',
      },
    ]);
  });

  it('throws on a query error', async () => {
    mockFrom.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'boom' } }));

    await expect(fetchAllCompletedWorkouts('user-1')).rejects.toThrow('boom');
  });
});

describe('fetchWorkoutIdForSet', () => {
  it('resolves a set id to its workout id', async () => {
    mockFrom.mockReturnValue(
      createQueryBuilder({
        data: { workout_exercise_id: 'we1', workout_exercises: { workout_id: 'w1' } },
        error: null,
      }),
    );

    expect(await fetchWorkoutIdForSet('set-1')).toBe('w1');
  });

  it('returns null when the set no longer exists', async () => {
    mockFrom.mockReturnValue(createQueryBuilder({ data: null, error: null }));

    expect(await fetchWorkoutIdForSet('set-1')).toBeNull();
  });

  it('throws on a query error', async () => {
    mockFrom.mockReturnValue(createQueryBuilder({ data: null, error: { message: 'boom' } }));

    await expect(fetchWorkoutIdForSet('set-1')).rejects.toThrow('boom');
  });
});
