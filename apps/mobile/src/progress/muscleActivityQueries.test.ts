import { supabase } from '../lib/supabase';
import { fetchMuscleActivity } from './muscleActivityQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

// The chainable-and-thenable builder the query tests share (see weeklySummaryQueries.test.ts).
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

function mockReads(...results: Result[]) {
  const builders = results.map((result) => createQueryBuilder(result));
  for (const { builder } of builders) mockFrom.mockImplementationOnce(() => builder);
  return builders;
}

beforeEach(() => mockFrom.mockReset());

const since = new Date(2026, 7, 28);

describe('fetchMuscleActivity', () => {
  it('reads finished workouts since then, their exercises of every type, and their working sets', async () => {
    const [workouts, exercises, sets] = mockReads(
      { data: [{ id: 'w1', performed_at: '2026-11-20T13:00:00.000Z' }], error: null },
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
          // Added but nothing finished: not trained.
          {
            id: 'we3',
            workout_id: 'w1',
            exercise_id: 'curl',
            measurement_type: 'weight_reps',
            exercises: { name: 'Curl', muscle_group: 'biceps' },
          },
        ],
        error: null,
      },
      {
        data: [
          { id: 's1', workout_exercise_id: 'we1', weight_kg: '80.00', reps: 8, is_drop: false },
          { id: 's2', workout_exercise_id: 'we1', weight_kg: '60.00', reps: 8, is_drop: true },
          { id: 's3', workout_exercise_id: 'we2', weight_kg: null, reps: null, is_drop: false },
        ],
        error: null,
      },
    );

    const result = await fetchMuscleActivity('user-1', since);

    expect(mockFrom.mock.calls.map((call) => call[0])).toEqual([
      'workouts',
      'workout_exercises',
      'sets',
    ]);
    expect(workouts!.calls.eq).toEqual([['user_id', 'user-1']]);
    expect(workouts!.calls.is).toEqual([['deleted_at', null]]);
    expect(workouts!.calls.not).toEqual([['completed_at', 'is', null]]);
    expect(workouts!.calls.gte).toEqual([['performed_at', since.toISOString()]]);
    expect(exercises!.calls.in).toEqual([['workout_id', ['w1']]]);
    expect(exercises!.calls.is).toEqual([['deleted_at', null]]);
    // Working sets only: finished, not deleted, never a warm-up.
    expect(sets!.calls.not).toEqual([['completed_at', 'is', null]]);
    expect(sets!.calls.eq).toEqual([['is_warmup', false]]);

    expect(result).toEqual([
      {
        workoutId: 'w1',
        performedAt: '2026-11-20T13:00:00.000Z',
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        muscleGroup: 'chest',
        secondaryMuscleGroups: [],
        measurementType: 'weight_reps',
        sets: [
          { weightKg: 80, reps: 8, isDrop: false },
          { weightKg: 60, reps: 8, isDrop: true },
        ],
      },
      {
        workoutId: 'w1',
        performedAt: '2026-11-20T13:00:00.000Z',
        exerciseId: 'plank',
        exerciseName: 'Plank',
        muscleGroup: 'core',
        secondaryMuscleGroups: [],
        measurementType: 'timed',
        sets: [{ weightKg: null, reps: null, isDrop: false }],
      },
    ]);
  });

  it('reads nothing more when there are no workouts', async () => {
    mockReads({ data: [], error: null });
    await expect(fetchMuscleActivity('user-1', since)).resolves.toEqual([]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('throws on a query error', async () => {
    mockReads({ data: null, error: { message: 'boom' } });
    await expect(fetchMuscleActivity('user-1', since)).rejects.toThrow('boom');
  });
});
