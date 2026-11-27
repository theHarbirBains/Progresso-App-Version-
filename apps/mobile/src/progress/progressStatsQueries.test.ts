import { supabase } from '../lib/supabase';
import {
  fetchAllCompletedWorkouts,
  fetchWorkoutCardioTimes,
  fetchWorkoutIdForSet,
} from './progressStatsQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

function createQueryBuilder(result: Result) {
  const methods = ['select', 'eq', 'in', 'is', 'not', 'order', 'range', 'maybeSingle'] as const;
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

describe('fetchWorkoutCardioTimes', () => {
  it("gives each workout with cardio its activities' times and its sets' -- warm-ups for time only", async () => {
    mockFrom.mockImplementation((table: string) =>
      createQueryBuilder(
        table === 'workout_cardio'
          ? {
              data: [
                { id: 'c1', workout_id: 'w1', duration_seconds: 1500 },
                { id: 'c2', workout_id: 'w1', duration_seconds: 600 },
                { id: 'c3', workout_id: 'run', duration_seconds: 1800 },
              ],
              error: null,
            }
          : table === 'workout_exercises'
            ? { data: [{ id: 'we1', workout_id: 'w1' }], error: null }
            : {
                data: [
                  {
                    id: 's1',
                    workout_exercise_id: 'we1',
                    completed_at: '2026-01-01T10:05:00Z',
                    is_warmup: true,
                  },
                  {
                    id: 's2',
                    workout_exercise_id: 'we1',
                    completed_at: '2026-01-01T10:09:00Z',
                    is_warmup: false,
                  },
                ],
                error: null,
              },
      ),
    );

    const times = await fetchWorkoutCardioTimes('user-1');

    expect(times.get('w1')).toEqual({
      cardio: [{ durationSeconds: 1500 }, { durationSeconds: 600 }],
      setTimes: ['2026-01-01T10:05:00Z', '2026-01-01T10:09:00Z'],
      hasStrength: true,
    });
    // Cardio alone: no sets, no strength.
    expect(times.get('run')).toEqual({
      cardio: [{ durationSeconds: 1800 }],
      setTimes: [],
      hasStrength: false,
    });
  });

  it('reads nothing more for someone with no cardio', async () => {
    mockFrom.mockReturnValue(createQueryBuilder({ data: [], error: null }));
    expect((await fetchWorkoutCardioTimes('user-1')).size).toBe(0);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
