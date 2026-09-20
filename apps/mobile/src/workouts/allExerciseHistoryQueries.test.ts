import { supabase } from '../lib/supabase';
import {
  fetchAllExerciseHistory,
  groupByExercise,
  type HistoricalSetWithExercise,
} from './allExerciseHistoryQueries';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

function createQueryBuilder(result: Result) {
  const methods = ['select', 'eq', 'is', 'in', 'not'] as const;
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

describe('fetchAllExerciseHistory', () => {
  it('joins sets to their workout date and exercise name across multiple exercises, sorted chronologically', async () => {
    mockTables({
      workout_exercises: {
        data: [
          {
            id: 'we1',
            exercise_id: 'ex-bench',
            exercises: { name: 'Bench Press', muscle_group: 'chest', movement_type: 'bilateral' },
            workouts: {
              performed_at: '2026-02-01T00:00:00Z',
              completed_at: '2026-02-01T01:00:00Z',
              deleted_at: null,
            },
          },
          {
            id: 'we2',
            exercise_id: 'ex-squat',
            exercises: {
              name: 'Squat',
              muscle_group: 'quadriceps',
              movement_type: 'bilateral',
            },
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
          { workout_exercise_id: 'we2', weight_kg: '150.00', reps: 5 },
        ],
        error: null,
      },
    });

    const result = await fetchAllExerciseHistory('user-1');

    expect(result).toEqual([
      {
        weightKg: 150,
        reps: 5,
        performedAt: '2026-01-01T00:00:00Z',
        workoutExerciseId: 'we2',
        exerciseId: 'ex-squat',
        exerciseName: 'Squat',
        muscleGroup: 'quadriceps',
        movementType: 'bilateral',
      },
      {
        weightKg: 110,
        reps: 8,
        performedAt: '2026-02-01T00:00:00Z',
        workoutExerciseId: 'we1',
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        muscleGroup: 'chest',
        movementType: 'bilateral',
      },
    ]);
  });

  it('falls back to "other"/"bilateral" when the exercise has somehow lost its join', async () => {
    mockTables({
      workout_exercises: {
        data: [
          {
            id: 'we1',
            exercise_id: 'ex-1',
            exercises: null,
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
        data: [{ workout_exercise_id: 'we1', weight_kg: '100.00', reps: 5 }],
        error: null,
      },
    });

    const result = await fetchAllExerciseHistory('user-1');

    expect(result[0].muscleGroup).toBe('other');
    expect(result[0].movementType).toBe('bilateral');
  });

  it('excludes planned-but-not-yet-performed sets (completed_at null) from the sets query', async () => {
    const tables = mockTables({
      workout_exercises: {
        data: [
          {
            id: 'we1',
            exercise_id: 'ex-1',
            exercises: { name: 'Bench Press', muscle_group: 'chest' },
            workouts: {
              performed_at: '2026-01-01T00:00:00Z',
              completed_at: '2026-01-01T01:00:00Z',
              deleted_at: null,
            },
          },
        ],
        error: null,
      },
      sets: { data: [], error: null },
    });

    await fetchAllExerciseHistory('user-1');

    expect(tables.sets.not).toHaveBeenCalledWith('completed_at', 'is', null);
  });

  it('excludes workout_exercises whose workout is not yet completed or is soft-deleted', async () => {
    mockTables({
      workout_exercises: {
        data: [
          {
            id: 'we-active',
            exercise_id: 'ex-1',
            exercises: { name: 'Deadlift' },
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

    const result = await fetchAllExerciseHistory('user-1');

    expect(result).toEqual([]);
  });

  it('returns an empty array without querying sets when there are no qualifying workout_exercises', async () => {
    const tables = mockTables({
      workout_exercises: { data: [], error: null },
      sets: { data: [], error: null },
    });

    const result = await fetchAllExerciseHistory('user-1');

    expect(result).toEqual([]);
    expect(tables.sets.in).not.toHaveBeenCalled();
  });

  it('throws on a workout_exercises query error', async () => {
    mockTables({
      workout_exercises: { data: null, error: { message: 'boom' } },
      sets: { data: [], error: null },
    });

    await expect(fetchAllExerciseHistory('user-1')).rejects.toThrow('boom');
  });

  it('throws on a sets query error', async () => {
    mockTables({
      workout_exercises: {
        data: [
          {
            id: 'we1',
            exercise_id: 'ex-1',
            exercises: { name: 'Bench Press' },
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

    await expect(fetchAllExerciseHistory('user-1')).rejects.toThrow('boom');
  });
});

describe('groupByExercise', () => {
  it('splits a combined feed back out per exercise', () => {
    const sets: HistoricalSetWithExercise[] = [
      {
        weightKg: 110,
        reps: 8,
        performedAt: '2026-02-01T00:00:00Z',
        workoutExerciseId: 'we1',
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        muscleGroup: 'chest',
        movementType: 'bilateral',
      },
      {
        weightKg: 150,
        reps: 5,
        performedAt: '2026-01-01T00:00:00Z',
        workoutExerciseId: 'we2',
        exerciseId: 'ex-squat',
        exerciseName: 'Squat',
        muscleGroup: 'quadriceps',
        movementType: 'bilateral',
      },
      {
        weightKg: 115,
        reps: 8,
        performedAt: '2026-03-01T00:00:00Z',
        workoutExerciseId: 'we3',
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        muscleGroup: 'chest',
        movementType: 'bilateral',
      },
    ];

    const groups = groupByExercise(sets);

    expect(groups).toHaveLength(2);
    const bench = groups.find((g) => g.exerciseId === 'ex-bench');
    expect(bench?.exerciseName).toBe('Bench Press');
    expect(bench?.sets).toEqual([
      { weightKg: 110, reps: 8, performedAt: '2026-02-01T00:00:00Z', workoutExerciseId: 'we1' },
      { weightKg: 115, reps: 8, performedAt: '2026-03-01T00:00:00Z', workoutExerciseId: 'we3' },
    ]);
  });

  it('returns an empty array for no sets', () => {
    expect(groupByExercise([])).toEqual([]);
  });
});
