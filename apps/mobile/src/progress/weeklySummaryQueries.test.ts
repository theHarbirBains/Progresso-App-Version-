import { supabase } from '../lib/supabase';
import { fetchSummaryTraining } from './weeklySummaryQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

// Same chainable-and-thenable mock builder pattern used throughout this
// codebase (see workoutQueries.test.ts).
function createQueryBuilder(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  const methods = ['select', 'eq', 'in', 'is', 'not', 'gte', 'lt', 'order', 'range'] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    calls[m] = [];
    builder[m] = jest.fn((...args: unknown[]) => {
      calls[m].push(args);
      return builder;
    });
  }
  builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return { builder, calls };
}

/** Each next supabase.from() call answers with the next result, in order. */
function mockReads(...results: Result[]) {
  const builders = results.map((result) => createQueryBuilder(result));
  for (const { builder } of builders) mockFrom.mockImplementationOnce(() => builder);
  return builders;
}

beforeEach(() => {
  mockFrom.mockReset();
});

const since = new Date(2026, 8, 14);
const until = new Date(2026, 9, 26);

describe('fetchSummaryTraining', () => {
  it("reads the user's completed workouts in the window, their exercises of every type, and their completed sets", async () => {
    const [workouts, exercises, sets] = mockReads(
      { data: [{ id: 'w1', performed_at: '2026-10-20T13:00:00.000Z' }], error: null },
      {
        data: [
          {
            id: 'we1',
            workout_id: 'w1',
            exercise_id: 'bench',
            measurement_type: 'weight_reps',
            exercises: { name: 'Bench Press', muscle_group: 'chest' },
          },
          {
            id: 'we2',
            workout_id: 'w1',
            exercise_id: 'plank',
            measurement_type: 'timed',
            exercises: { name: 'Plank', muscle_group: 'core' },
          },
        ],
        error: null,
      },
      {
        data: [
          { workout_exercise_id: 'we1', weight_kg: '80.00', reps: 8 },
          { workout_exercise_id: 'we2', weight_kg: null, reps: null },
        ],
        error: null,
      },
    );

    const result = await fetchSummaryTraining('user-1', since, until);

    expect(mockFrom.mock.calls.map((call) => call[0])).toEqual([
      'workouts',
      'workout_exercises',
      'sets',
    ]);
    expect(workouts!.calls.eq).toEqual([['user_id', 'user-1']]);
    expect(workouts!.calls.is).toEqual([['deleted_at', null]]);
    expect(workouts!.calls.not).toEqual([['completed_at', 'is', null]]);
    expect(workouts!.calls.gte).toEqual([['performed_at', since.toISOString()]]);
    expect(workouts!.calls.lt).toEqual([['performed_at', until.toISOString()]]);
    expect(exercises!.calls.in).toEqual([['workout_id', ['w1']]]);
    expect(sets!.calls.in).toEqual([['workout_exercise_id', ['we1', 'we2']]]);
    expect(sets!.calls.not).toEqual([['completed_at', 'is', null]]);

    expect(result.workouts).toEqual([{ id: 'w1', performedAt: '2026-10-20T13:00:00.000Z' }]);
    expect(result.sets).toEqual([
      {
        workoutId: 'w1',
        performedAt: '2026-10-20T13:00:00.000Z',
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        muscleGroup: 'chest',
        measurementType: 'weight_reps',
        weightKg: 80,
        reps: 8,
      },
      expect.objectContaining({ exerciseId: 'plank', measurementType: 'timed', weightKg: null }),
    ]);
  });

  it('reads nothing more when there are no workouts', async () => {
    mockReads({ data: [], error: null });

    await expect(fetchSummaryTraining('user-1', since, until)).resolves.toEqual({
      workouts: [],
      sets: [],
    });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('throws on a query error', async () => {
    mockReads({ data: null, error: { message: 'boom' } });

    await expect(fetchSummaryTraining('user-1', since, until)).rejects.toThrow('boom');
  });
});
