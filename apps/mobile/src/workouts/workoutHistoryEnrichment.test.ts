import { supabase } from '../lib/supabase';
import type { WorkoutSummary } from './workoutQueries';
import { enrichWorkoutSummaries } from './workoutHistoryEnrichment';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

function createQueryBuilder(result: Result) {
  const calls: Record<string, unknown[][]> = {};
  const methods = ['select', 'in', 'is', 'not'] as const;
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

function mockTables(byTable: Record<string, Result>) {
  const buildersByTable: Record<string, ReturnType<typeof createQueryBuilder>> = {};
  for (const [table, result] of Object.entries(byTable)) {
    buildersByTable[table] = createQueryBuilder(result);
  }
  mockFrom.mockImplementation((table: string) => buildersByTable[table]?.builder);
  return buildersByTable;
}

function workout(overrides: Partial<WorkoutSummary>): WorkoutSummary {
  return {
    id: 'w1',
    name: 'Push Day',
    performedAt: '2026-09-05T00:00:00Z',
    completedAt: '2026-09-05T01:00:00Z',
    workoutSplitDayId: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe('enrichWorkoutSummaries', () => {
  it('returns an empty array without querying anything for an empty input', async () => {
    const result = await enrichWorkoutSummaries([]);
    expect(result).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('attaches split day name/muscle groups and the completed set count', async () => {
    mockTables({
      workout_split_days: {
        data: [
          {
            id: 'day-push',
            name: 'Push',
            workout_split_day_muscle_groups: [
              { muscle_group: 'chest' },
              { muscle_group: 'shoulders' },
            ],
          },
        ],
        error: null,
      },
      workout_exercises: {
        data: [
          { id: 'we1', workout_id: 'w1' },
          { id: 'we2', workout_id: 'w1' },
        ],
        error: null,
      },
      sets: {
        data: [
          { workout_exercise_id: 'we1', weight_kg: 100, reps: 5 },
          { workout_exercise_id: 'we1', weight_kg: 80, reps: 8 },
          { workout_exercise_id: 'we2', weight_kg: 60, reps: 10 },
        ],
        error: null,
      },
    });

    const result = await enrichWorkoutSummaries([workout({ workoutSplitDayId: 'day-push' })]);

    expect(result).toEqual([
      {
        id: 'w1',
        name: 'Push Day',
        performedAt: '2026-09-05T00:00:00Z',
        completedAt: '2026-09-05T01:00:00Z',
        workoutSplitDayId: 'day-push',
        splitDayName: 'Push',
        muscleGroups: ['chest', 'shoulders'],
        completedSetCount: 3,
        // 100*5 + 80*8 + 60*10 = 500 + 640 + 600 = 1740
        totalVolumeKg: 1740,
        durationMinutes: 60,
        exerciseCount: 2,
      },
    ]);
  });

  it('counts exerciseCount as distinct workout_exercise rows, independent of how many sets each has', async () => {
    mockTables({
      workout_exercises: {
        data: [
          { id: 'we1', workout_id: 'w1' },
          { id: 'we2', workout_id: 'w1' },
          { id: 'we3', workout_id: 'w1' },
        ],
        error: null,
      },
      sets: {
        data: [{ workout_exercise_id: 'we1', weight_kg: 100, reps: 5 }],
        error: null,
      },
    });

    const result = await enrichWorkoutSummaries([workout({})]);

    expect(result[0].exerciseCount).toBe(3);
  });

  it('leaves splitDayName null and muscleGroups empty when no split day is tagged', async () => {
    mockTables({
      workout_exercises: { data: [], error: null },
      sets: { data: [], error: null },
    });

    const result = await enrichWorkoutSummaries([workout({ workoutSplitDayId: null })]);

    expect(result[0].splitDayName).toBeNull();
    expect(result[0].muscleGroups).toEqual([]);
    expect(result[0].completedSetCount).toBe(0);
  });

  it('only counts a set toward completedSetCount when it is actually complete', async () => {
    const tables = mockTables({
      workout_exercises: { data: [{ id: 'we1', workout_id: 'w1' }], error: null },
      sets: { data: [], error: null },
    });

    await enrichWorkoutSummaries([workout({})]);

    expect(tables.sets.calls.not).toEqual([
      ['completed_at', 'is', null],
      ['weight_kg', 'is', null],
      ['reps', 'is', null],
    ]);
  });

  it('excludes incomplete/blank sets from totalVolumeKg the same way it does for completedSetCount', async () => {
    const tables = mockTables({
      workout_exercises: { data: [{ id: 'we1', workout_id: 'w1' }], error: null },
      sets: { data: [], error: null },
    });

    const result = await enrichWorkoutSummaries([workout({})]);

    expect(result[0].totalVolumeKg).toBe(0);
    expect(tables.sets.calls.not).toEqual([
      ['completed_at', 'is', null],
      ['weight_kg', 'is', null],
      ['reps', 'is', null],
    ]);
  });

  it('computes duration as completedAt minus performedAt in whole minutes', async () => {
    mockTables({
      workout_exercises: { data: [], error: null },
      sets: { data: [], error: null },
    });

    const result = await enrichWorkoutSummaries([
      workout({ performedAt: '2026-09-05T00:00:00Z', completedAt: '2026-09-05T00:58:00Z' }),
    ]);

    expect(result[0].durationMinutes).toBe(58);
  });
});
