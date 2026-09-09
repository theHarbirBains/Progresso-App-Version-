import { supabase } from '../lib/supabase';
import {
  createWorkoutSplit,
  createWorkoutSplitDay,
  deleteWorkoutSplit,
  deleteWorkoutSplitDay,
  duplicateWorkoutSplit,
  fetchLastWorkoutSplitDayId,
  fetchWorkoutSplitDetail,
  fetchWorkoutSplits,
  materializeWorkoutSplitPreset,
  renameWorkoutSplit,
  renameWorkoutSplitDay,
  reorderWorkoutSplitDays,
  setWorkoutSplitDayMuscleGroups,
} from './workoutSplitQueries';
import type { WorkoutSplitPreset } from './workoutSplitPresets';

jest.mock('../lib/supabase', () => ({ supabase: { from: jest.fn() } }));

const mockFrom = supabase.from as jest.Mock;

interface Result {
  data: unknown;
  error: { message: string } | null;
}

function createQueryBuilder(result: Result) {
  const methods = [
    'select',
    'eq',
    'order',
    'insert',
    'update',
    'delete',
    'upsert',
    'not',
    'is',
    'limit',
  ] as const;
  const builder: Record<string, unknown> = {};
  for (const m of methods) {
    builder[m] = jest.fn(() => builder);
  }
  builder.single = jest.fn().mockResolvedValue(result);
  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.then = (resolve: (v: Result) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function mockTable(result: Result) {
  const builder = createQueryBuilder(result);
  mockFrom.mockImplementation(() => builder);
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

describe('fetchWorkoutSplits', () => {
  it('returns the list of splits', async () => {
    mockTable({ data: [{ id: 's1', name: 'PPL' }], error: null });

    await expect(fetchWorkoutSplits('user-1')).resolves.toEqual([{ id: 's1', name: 'PPL' }]);
  });

  it('throws on a query error', async () => {
    mockTable({ data: null, error: { message: 'boom' } });

    await expect(fetchWorkoutSplits('user-1')).rejects.toThrow('boom');
  });
});

describe('fetchWorkoutSplitDetail', () => {
  it('returns the split with ordered days and their muscle groups', async () => {
    mockTables({
      workout_splits: { data: { id: 's1', name: 'PPL' }, error: null },
      workout_split_days: {
        data: [
          {
            id: 'd1',
            name: 'Push',
            order_index: 1,
            workout_split_day_muscle_groups: [
              { muscle_group: 'chest' },
              { muscle_group: 'triceps' },
            ],
          },
        ],
        error: null,
      },
    });

    const result = await fetchWorkoutSplitDetail('s1');

    expect(result).toEqual({
      id: 's1',
      name: 'PPL',
      days: [{ id: 'd1', name: 'Push', orderIndex: 1, muscleGroups: ['chest', 'triceps'] }],
    });
  });

  it('throws when the split query errors', async () => {
    mockTables({
      workout_splits: { data: null, error: { message: 'not found' } },
      workout_split_days: { data: [], error: null },
    });

    await expect(fetchWorkoutSplitDetail('s1')).rejects.toThrow('not found');
  });
});

describe('createWorkoutSplit / renameWorkoutSplit / deleteWorkoutSplit', () => {
  it('creates a split', async () => {
    mockTable({ data: { id: 's1', name: 'PPL' }, error: null });

    await expect(createWorkoutSplit('user-1', 'PPL')).resolves.toEqual({ id: 's1', name: 'PPL' });
  });

  it('renames a split', async () => {
    const table = mockTable({ data: null, error: null });

    await renameWorkoutSplit('s1', 'New Name');

    expect(table.update).toHaveBeenCalledWith({ name: 'New Name' });
  });

  it('deletes a split', async () => {
    const table = mockTable({ data: null, error: null });

    await deleteWorkoutSplit('s1');

    expect(table.delete).toHaveBeenCalled();
    expect(table.eq).toHaveBeenCalledWith('id', 's1');
  });
});

describe('createWorkoutSplitDay / renameWorkoutSplitDay / deleteWorkoutSplitDay', () => {
  it('creates a day', async () => {
    mockTable({ data: { id: 'd1', name: 'Push', order_index: 1 }, error: null });

    await expect(createWorkoutSplitDay('s1', 'Push', 1)).resolves.toEqual({
      id: 'd1',
      name: 'Push',
      orderIndex: 1,
      muscleGroups: [],
    });
  });

  it('renames a day', async () => {
    const table = mockTable({ data: null, error: null });

    await renameWorkoutSplitDay('d1', 'Upper A');

    expect(table.update).toHaveBeenCalledWith({ name: 'Upper A' });
  });

  it('deletes a day', async () => {
    const table = mockTable({ data: null, error: null });

    await deleteWorkoutSplitDay('d1');

    expect(table.delete).toHaveBeenCalled();
  });
});

describe('reorderWorkoutSplitDays', () => {
  it('upserts every day with a fresh 1-based order_index', async () => {
    const table = mockTable({ data: null, error: null });

    await reorderWorkoutSplitDays('s1', [
      { id: 'd2', name: 'Pull' },
      { id: 'd1', name: 'Push' },
    ]);

    expect(table.upsert).toHaveBeenCalledWith([
      { id: 'd2', workout_split_id: 's1', name: 'Pull', order_index: 1 },
      { id: 'd1', workout_split_id: 's1', name: 'Push', order_index: 2 },
    ]);
  });
});

describe('setWorkoutSplitDayMuscleGroups', () => {
  it('deletes the existing set and inserts the new one', async () => {
    const table = mockTable({ data: null, error: null });

    await setWorkoutSplitDayMuscleGroups('d1', ['chest', 'triceps']);

    expect(table.delete).toHaveBeenCalled();
    expect(table.insert).toHaveBeenCalledWith([
      { workout_split_day_id: 'd1', muscle_group: 'chest' },
      { workout_split_day_id: 'd1', muscle_group: 'triceps' },
    ]);
  });

  it('skips the insert call when given an empty list', async () => {
    const table = mockTable({ data: null, error: null });

    await setWorkoutSplitDayMuscleGroups('d1', []);

    expect(table.delete).toHaveBeenCalled();
    expect(table.insert).not.toHaveBeenCalled();
  });
});

describe('fetchLastWorkoutSplitDayId', () => {
  it("returns the most recent completed workout's split day id", async () => {
    mockTable({ data: { workout_split_day_id: 'd1' }, error: null });

    await expect(fetchLastWorkoutSplitDayId('user-1')).resolves.toBe('d1');
  });

  it('returns null when there is no completed workout', async () => {
    mockTable({ data: null, error: null });

    await expect(fetchLastWorkoutSplitDayId('user-1')).resolves.toBeNull();
  });

  it('returns null when the most recent workout has no split day tag', async () => {
    mockTable({ data: { workout_split_day_id: null }, error: null });

    await expect(fetchLastWorkoutSplitDayId('user-1')).resolves.toBeNull();
  });
});

describe('duplicateWorkoutSplit', () => {
  it('creates a copy with the same days and muscle groups', async () => {
    let createSplitCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workout_splits') {
        const builder = createQueryBuilder({ data: { id: 's1', name: 'PPL' }, error: null });
        builder.single = jest.fn(() => {
          createSplitCallCount += 1;
          return Promise.resolve(
            createSplitCallCount === 1
              ? { data: { id: 's1', name: 'PPL' }, error: null }
              : { data: { id: 's2', name: 'PPL Copy' }, error: null },
          );
        });
        return builder;
      }
      if (table === 'workout_split_days') {
        const builder = createQueryBuilder({ data: [], error: null });
        builder.select = jest.fn(() => builder);
        builder.eq = jest.fn(() => builder);
        builder.order = jest.fn(() =>
          Promise.resolve({
            data: [
              {
                id: 'd1',
                name: 'Push',
                order_index: 1,
                workout_split_day_muscle_groups: [{ muscle_group: 'chest' }],
              },
            ],
            error: null,
          }),
        );
        builder.insert = jest.fn(() => builder);
        builder.single = jest
          .fn()
          .mockResolvedValue({ data: { id: 'd2', name: 'Push', order_index: 1 }, error: null });
        return builder;
      }
      if (table === 'workout_split_day_muscle_groups') {
        const builder = createQueryBuilder({ data: null, error: null });
        return builder;
      }
      throw new Error(`unexpected table ${table}`);
    });

    const result = await duplicateWorkoutSplit('user-1', 's1');

    expect(result).toEqual({ id: 's2', name: 'PPL Copy' });
  });
});

describe('materializeWorkoutSplitPreset', () => {
  it('creates a real, user-owned split with each preset day and its muscle groups', async () => {
    let daySeq = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workout_splits') {
        return createQueryBuilder({
          data: { id: 'split-new', name: 'Push / Pull / Legs' },
          error: null,
        });
      }
      if (table === 'workout_split_days') {
        const builder = createQueryBuilder({ data: null, error: null });
        builder.single = jest.fn(() => {
          daySeq += 1;
          return Promise.resolve({
            data: { id: `day-${daySeq}`, name: `Day ${daySeq}`, order_index: daySeq },
            error: null,
          });
        });
        return builder;
      }
      if (table === 'workout_split_day_muscle_groups') {
        return createQueryBuilder({ data: null, error: null });
      }
      throw new Error(`unexpected table ${table}`);
    });

    const preset: WorkoutSplitPreset = {
      id: 'ppl',
      name: 'Push / Pull / Legs',
      days: [
        { name: 'Push', muscleGroups: ['chest', 'triceps'] },
        { name: 'Pull', muscleGroups: ['back'] },
      ],
    };

    const result = await materializeWorkoutSplitPreset('user-1', preset);

    expect(result).toEqual({ id: 'split-new', name: 'Push / Pull / Legs' });
    expect(daySeq).toBe(2);
  });
});
