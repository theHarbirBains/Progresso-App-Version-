import { supabase } from '../lib/supabase';
import {
  addExerciseToWorkout,
  completeWorkout,
  createSet,
  createWorkout,
  deleteSet,
  fetchActiveWorkout,
  fetchPreviousPerformance,
  fetchWorkoutDetail,
  fetchWorkoutHistory,
  removeExerciseFromWorkout,
  reorderExercises,
  updateSet,
} from './workoutQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string; code?: string } | null;
}

// Every chainable filter method returns the same builder (so any call
// order/length works), and the builder is itself thenable -- matching real
// supabase-js PostgrestFilterBuilder, which resolves whenever awaited,
// regardless of which method was called last. .single()/.maybeSingle() are
// explicit terminal methods, matching real usage.
function createQueryBuilder(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  const methods = [
    'select',
    'eq',
    'is',
    'not',
    'neq',
    'in',
    'order',
    'range',
    'limit',
    'insert',
    'update',
    'upsert',
  ] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    calls[m] = [];
    builder[m] = jest.fn((...args: unknown[]) => {
      calls[m].push(args);
      return builder;
    });
  }
  builder.single = jest.fn().mockResolvedValue(result);
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return { builder, calls };
}

/** Configures supabase.from(table) to return a fresh builder per table name. */
function mockTables(byTable: Record<string, Result>) {
  const buildersByTable: Record<string, ReturnType<typeof createQueryBuilder>> = {};
  for (const [table, result] of Object.entries(byTable)) {
    buildersByTable[table] = createQueryBuilder(result);
  }
  mockFrom.mockImplementation((table: string) => buildersByTable[table]?.builder);
  return buildersByTable;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('fetchActiveWorkout', () => {
  it('returns the active workout when one exists', async () => {
    mockTables({
      workouts: {
        data: {
          id: 'w1',
          name: 'Push Day',
          performed_at: '2026-01-01T00:00:00Z',
          completed_at: null,
        },
        error: null,
      },
    });

    const result = await fetchActiveWorkout('user-1');

    expect(result).toEqual({
      id: 'w1',
      name: 'Push Day',
      performedAt: '2026-01-01T00:00:00Z',
      completedAt: null,
    });
  });

  it('returns null when there is no active workout', async () => {
    mockTables({ workouts: { data: null, error: null } });

    await expect(fetchActiveWorkout('user-1')).resolves.toBeNull();
  });

  it('throws on a query error', async () => {
    mockTables({ workouts: { data: null, error: { message: 'boom' } } });

    await expect(fetchActiveWorkout('user-1')).rejects.toThrow('boom');
  });
});

describe('fetchWorkoutHistory', () => {
  it('maps rows and computes hasMore from a full page', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      id: `w${i}`,
      name: `Workout ${i}`,
      performed_at: '2026-01-01T00:00:00Z',
      completed_at: '2026-01-01T01:00:00Z',
    }));
    const { workouts } = mockTables({ workouts: { data: rows, error: null } });

    const result = await fetchWorkoutHistory('user-1', 0, 20);

    expect(result.rows).toHaveLength(20);
    expect(result.hasMore).toBe(true);
    expect(workouts.calls.eq).toEqual([['user_id', 'user-1']]);
    expect(workouts.calls.range).toEqual([[0, 19]]);
  });

  it('reports hasMore=false for a partial page', async () => {
    mockTables({
      workouts: {
        data: [
          {
            id: 'w1',
            name: 'X',
            performed_at: '2026-01-01T00:00:00Z',
            completed_at: '2026-01-01T01:00:00Z',
          },
        ],
        error: null,
      },
    });

    const result = await fetchWorkoutHistory('user-1', 0, 20);

    expect(result.hasMore).toBe(false);
  });
});

describe('fetchWorkoutDetail', () => {
  it('assembles workout + exercises + sets into one detail object', async () => {
    mockTables({
      workouts: {
        data: {
          id: 'w1',
          name: 'Push Day',
          performed_at: '2026-01-01T00:00:00Z',
          completed_at: null,
        },
        error: null,
      },
      workout_exercises: {
        data: [
          {
            id: 'we1',
            exercise_id: 'ex1',
            order_index: 1,
            exercises: { name: 'Bench Press', muscle_group: 'chest' },
          },
        ],
        error: null,
      },
      sets: {
        data: [
          { id: 's1', workout_exercise_id: 'we1', set_index: 1, weight_kg: '100.00', reps: 5 },
          { id: 's2', workout_exercise_id: 'we1', set_index: 2, weight_kg: '110.00', reps: 3 },
        ],
        error: null,
      },
    });

    const result = await fetchWorkoutDetail('w1');

    expect(result).toEqual({
      id: 'w1',
      name: 'Push Day',
      performedAt: '2026-01-01T00:00:00Z',
      completedAt: null,
      exercises: [
        {
          id: 'we1',
          exerciseId: 'ex1',
          exerciseName: 'Bench Press',
          muscleGroup: 'chest',
          orderIndex: 1,
          sets: [
            { id: 's1', setIndex: 1, weightKg: 100, reps: 5 },
            { id: 's2', setIndex: 2, weightKg: 110, reps: 3 },
          ],
        },
      ],
    });
  });

  it('returns an empty exercises array without querying sets when there are no workout_exercises', async () => {
    const tables = mockTables({
      workouts: {
        data: {
          id: 'w1',
          name: 'Push Day',
          performed_at: '2026-01-01T00:00:00Z',
          completed_at: null,
        },
        error: null,
      },
      workout_exercises: { data: [], error: null },
      sets: { data: [], error: null },
    });

    const result = await fetchWorkoutDetail('w1');

    expect(result.exercises).toEqual([]);
    expect(tables.sets.builder.in).not.toHaveBeenCalled();
  });
});

describe('createWorkout', () => {
  it('returns a created result on success', async () => {
    mockTables({
      workouts: {
        data: {
          id: 'w1',
          name: 'Push Day',
          performed_at: '2026-01-01T00:00:00Z',
          completed_at: null,
        },
        error: null,
      },
    });

    const result = await createWorkout('user-1', 'Push Day');

    expect(result).toEqual({
      type: 'created',
      workout: {
        id: 'w1',
        name: 'Push Day',
        performedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      },
    });
  });

  it('returns a conflict result (not a throw) when the one-active-workout constraint is hit', async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return createQueryBuilder({
          data: null,
          error: {
            message:
              'duplicate key value violates unique constraint "workouts_one_active_per_user"',
            code: '23505',
          },
        }).builder;
      }
      return createQueryBuilder({
        data: {
          id: 'existing',
          name: 'Leg Day',
          performed_at: '2026-01-01T00:00:00Z',
          completed_at: null,
        },
        error: null,
      }).builder;
    });

    const result = await createWorkout('user-1', 'Push Day');

    expect(result).toEqual({
      type: 'conflict',
      existingWorkout: {
        id: 'existing',
        name: 'Leg Day',
        performedAt: '2026-01-01T00:00:00Z',
        completedAt: null,
      },
    });
  });

  it('throws for an unrelated database error', async () => {
    mockTables({ workouts: { data: null, error: { message: 'connection lost', code: '08000' } } });

    await expect(createWorkout('user-1', 'Push Day')).rejects.toThrow('connection lost');
  });
});

describe('completeWorkout', () => {
  it('updates completed_at', async () => {
    const { workouts } = mockTables({ workouts: { data: null, error: null } });

    await completeWorkout('w1');

    expect(workouts.builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ completed_at: expect.any(String) }),
    );
    expect(workouts.calls.eq).toEqual([['id', 'w1']]);
  });
});

describe('addExerciseToWorkout', () => {
  it('inserts and returns the new id', async () => {
    mockTables({ workout_exercises: { data: { id: 'we1' }, error: null } });

    const id = await addExerciseToWorkout('w1', 'ex1', 1);

    expect(id).toBe('we1');
  });
});

describe('removeExerciseFromWorkout', () => {
  it('soft-deletes via deleted_at', async () => {
    const { workout_exercises: workoutExercises } = mockTables({
      workout_exercises: { data: null, error: null },
    });

    await removeExerciseFromWorkout('we1');

    expect(workoutExercises.builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
  });
});

describe('reorderExercises', () => {
  it('sends a single bulk upsert covering every item', async () => {
    const { workout_exercises: workoutExercises } = mockTables({
      workout_exercises: { data: null, error: null },
    });

    await reorderExercises([
      { id: 'we1', workoutId: 'w1', exerciseId: 'ex1', orderIndex: 2 },
      { id: 'we2', workoutId: 'w1', exerciseId: 'ex2', orderIndex: 1 },
    ]);

    expect(workoutExercises.builder.upsert).toHaveBeenCalledTimes(1);
    expect(workoutExercises.builder.upsert).toHaveBeenCalledWith([
      { id: 'we1', workout_id: 'w1', exercise_id: 'ex1', order_index: 2 },
      { id: 'we2', workout_id: 'w1', exercise_id: 'ex2', order_index: 1 },
    ]);
  });
});

describe('createSet/updateSet/deleteSet', () => {
  it('createSet inserts and maps the result', async () => {
    mockTables({
      sets: { data: { id: 's1', set_index: 1, weight_kg: '100.00', reps: 5 }, error: null },
    });

    const result = await createSet('we1', 1, 100, 5);

    expect(result).toEqual({ id: 's1', setIndex: 1, weightKg: 100, reps: 5 });
  });

  it('updateSet only sends the provided fields', async () => {
    const { sets } = mockTables({
      sets: { data: { id: 's1', set_index: 1, weight_kg: '105.00', reps: 5 }, error: null },
    });

    await updateSet('s1', { weightKg: 105 });

    expect(sets.builder.update).toHaveBeenCalledWith({ weight_kg: 105 });
  });

  it('deleteSet soft-deletes via deleted_at', async () => {
    const { sets } = mockTables({ sets: { data: null, error: null } });

    await deleteSet('s1');

    expect(sets.builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ deleted_at: expect.any(String) }),
    );
  });
});

describe('fetchPreviousPerformance', () => {
  it('returns the most recent qualifying workout_exercise sets', async () => {
    mockTables({
      workout_exercises: {
        data: [
          {
            id: 'we-old',
            workout_id: 'w-old',
            workouts: { performed_at: '2026-01-01T00:00:00Z', deleted_at: null },
          },
          {
            id: 'we-new',
            workout_id: 'w-new',
            workouts: { performed_at: '2026-01-10T00:00:00Z', deleted_at: null },
          },
        ],
        error: null,
      },
      sets: {
        data: [{ id: 's1', set_index: 1, weight_kg: '135.00', reps: 10 }],
        error: null,
      },
    });

    const result = await fetchPreviousPerformance('user-1', 'ex1', 'w-current');

    expect(result).toEqual({
      performedAt: '2026-01-10T00:00:00Z',
      sets: [{ id: 's1', setIndex: 1, weightKg: 135, reps: 10 }],
    });
  });

  it('ignores candidates whose workout is soft-deleted', async () => {
    mockTables({
      workout_exercises: {
        data: [
          {
            id: 'we1',
            workout_id: 'w1',
            workouts: { performed_at: '2026-01-01T00:00:00Z', deleted_at: '2026-01-02T00:00:00Z' },
          },
        ],
        error: null,
      },
      sets: { data: [], error: null },
    });

    const result = await fetchPreviousPerformance('user-1', 'ex1', 'w-current');

    expect(result).toBeNull();
  });

  it('returns null when there are no candidates at all', async () => {
    mockTables({ workout_exercises: { data: [], error: null } });

    const result = await fetchPreviousPerformance('user-1', 'ex1', 'w-current');

    expect(result).toBeNull();
  });
});
